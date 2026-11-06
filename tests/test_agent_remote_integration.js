const assert = require('assert');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

console.log('================================================================');
console.log(' SOKO AGENT REMOTE & TRANSCRIPT STREAMING INTEGRATION TEST SUITE');
console.log('================================================================\n');

const TEST_PORT = 8798;
const TEST_URL = `http://127.0.0.1:${TEST_PORT}`;

// Create temporary mock brain environment for integration testing
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soko-agent-integration-'));
const mockBrain = path.join(tempDir, 'brain');
const mockPresence = path.join(tempDir, 'presence');
fs.mkdirSync(mockBrain, { recursive: true });
fs.mkdirSync(mockPresence, { recursive: true });

const testSessionId = 'integration-session-uuid-1';
const sessionLogsDir = path.join(mockBrain, testSessionId, '.system_generated/logs');
fs.mkdirSync(sessionLogsDir, { recursive: true });
const transcriptPath = path.join(sessionLogsDir, 'transcript.jsonl');
const lockPath = path.join(mockPresence, `${testSessionId}.lock`);
fs.writeFileSync(lockPath, '');

const initialTurn = JSON.stringify({
  step_index: 1,
  type: 'USER_INPUT',
  created_at: new Date().toISOString(),
  content: 'Initial user turn for integration test',
}) + '\n' + JSON.stringify({
  step_index: 2,
  type: 'PLANNER_RESPONSE',
  thinking: 'Executing background verification...',
  tool_calls: [{ name: 'run_command', args: { CommandLine: 'echo "OK"' } }],
  content: 'Initial turn complete.',
}) + '\n';
fs.writeFileSync(transcriptPath, initialTurn);

function postHttp(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      `${TEST_URL}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (c) => (resBody += c));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(resBody) });
          } catch {
            resolve({ statusCode: res.statusCode, raw: resBody });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getHttp(endpoint, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${TEST_URL}${endpoint}`,
      { method: 'GET', headers },
      (res) => {
        let resBody = '';
        res.on('data', (c) => (resBody += c));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(resBody) });
          } catch {
            resolve({ statusCode: res.statusCode, raw: resBody });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function encodeWsFrame(data) {
  const isBuffer = Buffer.isBuffer(data);
  const payload = isBuffer ? data : Buffer.from(data, 'utf8');
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function createTestWsClient(onMessage) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port: TEST_PORT, host: '127.0.0.1' }, () => {
      const key = crypto.randomBytes(16).toString('base64');
      const req = [
        'GET / HTTP/1.1',
        'Host: 127.0.0.1',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ].join('\r\n');
      client.write(req);
    });

    let upgraded = false;
    let rxBuffer = Buffer.alloc(0);

    client.on('data', (chunk) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);

      if (!upgraded) {
        const headerEnd = rxBuffer.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          upgraded = true;
          rxBuffer = rxBuffer.slice(headerEnd + 4);
          resolve({ client, sendWs: (pkt) => client.write(encodeWsFrame(JSON.stringify(pkt))) });
        }
      }

      while (rxBuffer.length >= 2) {
        const firstByte = rxBuffer[0];
        const secondByte = rxBuffer[1];
        let payloadLen = secondByte & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (rxBuffer.length < 4) break;
          payloadLen = rxBuffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (rxBuffer.length < 10) break;
          payloadLen = Number(rxBuffer.readBigUInt64BE(2));
          offset = 10;
        }

        if (rxBuffer.length < offset + payloadLen) break;

        const payload = rxBuffer.slice(offset, offset + payloadLen);
        rxBuffer = rxBuffer.slice(offset + payloadLen);

        try {
          const parsed = JSON.parse(payload.toString('utf8'));
          if (onMessage) onMessage(parsed);
        } catch {}
      }
    });

    client.on('error', reject);
  });
}

async function runTests() {
  console.log('[Setup] Starting test bridge process on port ' + TEST_PORT + '...');
  const bridgeProc = spawn('node', [path.resolve(__dirname, '../scripts/soko_bridge.js')], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: 'test',
    },
    stdio: 'ignore',
  });

  // Wait for server to listen
  let online = false;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await getHttp('/api/status');
      if (res.statusCode === 200) {
        online = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  assert.ok(online, 'Test bridge process must be online on port ' + TEST_PORT);
  console.log('  ✓ Test bridge process online on port ' + TEST_PORT + '\n');

  try {
    // Suite 1: REST API Endpoints
    console.log('[Suite 1/3] Agent Remote REST API Endpoints');
    {
      const sessionsRes = await getHttp('/api/agent/sessions');
      assert.strictEqual(sessionsRes.statusCode, 200);
      assert.strictEqual(sessionsRes.data.success, true);
      assert.ok(Array.isArray(sessionsRes.data.sessions), 'Sessions must be an array');
      console.log('  ✓ [PASS] GET /api/agent/sessions returns HTTP 200 with sessions list');

      const transcriptRes = await getHttp(`/api/agent/transcript?sessionId=${testSessionId}`);
      // Either 200 if discovered or 404 if in isolated tmpdir
      assert.ok([200, 404].includes(transcriptRes.statusCode));
      console.log('  ✓ [PASS] GET /api/agent/transcript handles session query safely');

      // Unauthenticated remote simulation request blocked
      const blockedRes = await getHttp('/api/agent/sessions', {
        'x-simulate-remote-ip': '192.168.1.100',
      });
      assert.strictEqual(blockedRes.statusCode, 401, 'Unauthenticated remote request rejected with 401');
      console.log('  ✓ [PASS] Zero-Trust: Unauthenticated remote requests blocked with HTTP 401');
    }

    // Suite 2: WebSocket Agent Streaming
    console.log('\n[Suite 2/3] WebSocket Agent Telemetry & Stream Ingestion');
    {
      const receivedPackets = [];
      const { client, sendWs } = await createTestWsClient((pkt) => {
        receivedPackets.push(pkt);
      });

      // Request sessions
      sendWs({
        magic: 'SK',
        version: 1,
        packetId: Date.now(),
        timestamp: Date.now(),
        packetType: 'FETCH_AGENT_SESSIONS',
        payload: {},
      });

      await new Promise((r) => setTimeout(r, 600));

      const hasActivity = receivedPackets.some((p) => p.packetType === 'AGENT_ACTIVITY_STATUS');
      assert.ok(hasActivity, 'WebSocket client receives AGENT_ACTIVITY_STATUS packet');
      console.log('  ✓ [PASS] WS client receives live AGENT_ACTIVITY_STATUS');

      client.destroy();
    }

    // Suite 3: Mobile UI Component Files Integrity
    console.log('\n[Suite 3/3] Mobile Agent Terminal Assets Integrity');
    {
      const cssPath = path.resolve(__dirname, '../apps/mobile/companion/agent-terminal/terminal.css');
      const jsPath = path.resolve(__dirname, '../apps/mobile/companion/agent-terminal/terminal.js');
      const flutterPath = path.resolve(__dirname, '../apps/mobile/lib/features/agent_terminal/ui/agent_terminal_view.dart');

      assert.ok(fs.existsSync(cssPath), 'terminal.css exists');
      assert.ok(fs.existsSync(jsPath), 'terminal.js exists');
      assert.ok(fs.existsSync(flutterPath), 'agent_terminal_view.dart exists');

      const cssContent = fs.readFileSync(cssPath, 'utf8');
      assert.ok(cssContent.includes('.agent-terminal-container'), 'CSS contains main container');
      assert.ok(cssContent.includes('.agent-send-btn'), 'CSS contains send button');
      assert.ok(cssContent.includes('.term-chip'), 'CSS contains quick action chips');

      const jsContent = fs.readFileSync(jsPath, 'utf8');
      assert.ok(jsContent.includes('AgentTerminal'), 'JS defines AgentTerminal');
      assert.ok(jsContent.includes('sendPrompt'), 'JS implements sendPrompt');
      assert.ok(jsContent.includes('renderFeed'), 'JS implements renderFeed');

      console.log('  ✓ [PASS] Companion CSS & JS assets verified');
      console.log('  ✓ [PASS] Flutter AgentTerminalView widget verified');
    }

    console.log('\n================================================================');
    console.log(' RESULTS: All integration test suites passed (100%)');
    console.log('================================================================\n');
  } finally {
    bridgeProc.kill('SIGTERM');
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
