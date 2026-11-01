const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { RollingFileLogger, resolveStandardLogDir } = require('../index.js');

const tmpDir = path.join(os.tmpdir(), `soko-logger-test-${Date.now()}`);

try {
  console.log('[Test] Running @soko/logger unit tests in:', tmpDir);

  // Test 1: Directory & Log file creation
  const logger = new RollingFileLogger({
    appName: 'soko-test',
    logDir: tmpDir,
    filename: 'test.log',
    maxFileSizeBytes: 500, // Small limit for testing rotation
    maxHistoryFiles: 3,
  });

  assert.strictEqual(fs.existsSync(logger.getLogPath()), true);

  // Test 2: Writing entries
  logger.writeEntry('INFO', 'Test log entry 1');
  let content = fs.readFileSync(logger.getLogPath(), 'utf8');
  assert.ok(content.includes('[INFO] Test log entry 1'));

  // Test 3: Log rotation triggers on exceeding maxFileSizeBytes
  // Write entries to exceed 500 bytes
  for (let i = 0; i < 20; i++) {
    logger.writeEntry('INFO', `Payload entry padding line ${i} with extra text to exceed size boundary`);
  }

  // Check that historical files were created
  assert.strictEqual(fs.existsSync(`${logger.getLogPath()}.1`), true);

  // Test 4: Attaching and detaching console
  logger.attachConsole();
  console.log('Intercepted log message');
  console.warn('Intercepted warning message');
  logger.detachConsole();

  content = fs.readFileSync(logger.getLogPath(), 'utf8');
  assert.ok(content.includes('Intercepted log message') || fs.readFileSync(`${logger.getLogPath()}.1`, 'utf8').includes('Intercepted log message'));

  console.log('✓ All @soko/logger tests passed cleanly!');
} finally {
  // Cleanup tmp dir
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}
