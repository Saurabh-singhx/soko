/**
 * @file mdnsAdvertiser.js
 * Zero-dependency RFC 6762 / RFC 6763 Multicast DNS (mDNS / Zeroconf) Advertiser & Responder.
 * Uses Node.js native `dgram` module.
 *
 * Advertises:
 *   _soko._tcp.local
 * Providing PTR, SRV, TXT, and A records for desktop Dynamic Island discoverability.
 */

const dgram = require('dgram');
const os = require('os');

const MDNS_MULTICAST_ADDR = '224.0.0.251';
const MDNS_PORT = 5353;
const SERVICE_TYPE = '_soko._tcp.local';
const DNS_SD_DISCOVERY = '_services._dns-sd._udp.local';

// DNS Record Types
const TYPE_A = 1;
const TYPE_PTR = 12;
const TYPE_TXT = 16;
const TYPE_SRV = 33;

// DNS Classes
const CLASS_IN = 1;
const CLASS_IN_FLUSH = 0x8001; // Cache-flush bit (RFC 6762 §10.2)

/**
 * Encodes a domain name into DNS wire format.
 */
function encodeDnsName(name) {
  if (!name || name === '.') {
    return Buffer.from([0]);
  }
  const parts = name.replace(/\.$/, '').split('.');
  const buffers = [];
  for (const part of parts) {
    const partBuf = Buffer.from(part, 'utf8');
    if (partBuf.length > 63) {
      throw new Error(`DNS label too long: ${part}`);
    }
    buffers.push(Buffer.from([partBuf.length]));
    buffers.push(partBuf);
  }
  buffers.push(Buffer.from([0]));
  return Buffer.concat(buffers);
}

/**
 * Decodes a domain name from DNS packet at offset.
 */
function decodeDnsName(buf, offset = 0) {
  const labels = [];
  let curr = offset;
  let jumped = false;
  let nextOffset = offset;

  while (curr < buf.length) {
    const len = buf[curr];
    if (len === 0) {
      if (!jumped) nextOffset = curr + 1;
      break;
    }

    if ((len & 0xc0) === 0xc0) {
      const pointer = ((len & 0x3f) << 8) | buf[curr + 1];
      if (!jumped) nextOffset = curr + 2;
      jumped = true;
      curr = pointer;
      continue;
    }

    curr++;
    labels.push(buf.toString('utf8', curr, curr + len));
    curr += len;
    if (!jumped) nextOffset = curr;
  }

  return { name: labels.join('.').toLowerCase(), bytesRead: nextOffset - offset };
}

/**
 * Encodes TXT record attributes into DNS wire format.
 */
function encodeTxtRecord(attributes) {
  const buffers = [];
  for (const [key, val] of Object.entries(attributes)) {
    if (val === undefined || val === null) continue;
    const str = `${key}=${val}`;
    const strBuf = Buffer.from(str, 'utf8');
    if (strBuf.length > 255) continue;
    buffers.push(Buffer.from([strBuf.length]));
    buffers.push(strBuf);
  }
  if (buffers.length === 0) {
    buffers.push(Buffer.from([0]));
  }
  return Buffer.concat(buffers);
}

function buildResourceRecord(name, type, classVal, ttl, rdata) {
  const nameBuf = encodeDnsName(name);
  const header = Buffer.alloc(10);
  header.writeUInt16BE(type, 0);
  header.writeUInt16BE(classVal, 2);
  header.writeUInt32BE(ttl, 4);
  header.writeUInt16BE(rdata.length, 8);
  return Buffer.concat([nameBuf, header, rdata]);
}

/**
 * Encodes an mDNS announcement / response packet.
 */
function buildMdnsResponsePacket({
  instanceName,
  hostname,
  port,
  ips,
  txtRecords,
  ttl = 120,
}) {
  const answers = [];

  // 1. PTR: _services._dns-sd._udp.local -> _soko._tcp.local
  answers.push(buildResourceRecord(DNS_SD_DISCOVERY, TYPE_PTR, CLASS_IN, ttl, encodeDnsName(SERVICE_TYPE)));

  // 2. PTR: _soko._tcp.local -> <instanceName>._soko._tcp.local
  const fqInstance = `${instanceName}.${SERVICE_TYPE}`;
  answers.push(buildResourceRecord(SERVICE_TYPE, TYPE_PTR, CLASS_IN, ttl, encodeDnsName(fqInstance)));

  // 3. SRV: <instanceName>._soko._tcp.local -> Priority=0, Weight=0, Port, Hostname
  const targetHost = `${hostname}.local`;
  const srvRdata = Buffer.alloc(6);
  srvRdata.writeUInt16BE(0, 0);
  srvRdata.writeUInt16BE(0, 2);
  srvRdata.writeUInt16BE(port, 4);
  const srvFullRdata = Buffer.concat([srvRdata, encodeDnsName(targetHost)]);
  answers.push(buildResourceRecord(fqInstance, TYPE_SRV, CLASS_IN_FLUSH, ttl, srvFullRdata));

  // 4. TXT: <instanceName>._soko._tcp.local -> metadata
  const txtRdata = encodeTxtRecord(txtRecords);
  answers.push(buildResourceRecord(fqInstance, TYPE_TXT, CLASS_IN_FLUSH, ttl, txtRdata));

  // 5. A records: <hostname>.local -> IPv4 addresses
  for (const ip of ips) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length === 4 && !parts.some(isNaN)) {
      const aRdata = Buffer.from(parts);
      answers.push(buildResourceRecord(targetHost, TYPE_A, CLASS_IN_FLUSH, ttl, aRdata));
    }
  }

  const header = Buffer.alloc(12);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(0x8400, 2);
  header.writeUInt16BE(0, 4);
  header.writeUInt16BE(answers.length, 6);
  header.writeUInt16BE(0, 8);
  header.writeUInt16BE(0, 10);

  return Buffer.concat([header, ...answers]);
}

/**
 * Parses query names and types from an incoming mDNS packet.
 */
function parseMdnsQuery(buf) {
  if (buf.length < 12) return { questions: [] };

  const flags = buf.readUInt16BE(2);
  const isQuery = (flags & 0x8000) === 0;
  if (!isQuery) return { questions: [] };

  const qdCount = buf.readUInt16BE(4);
  let offset = 12;
  const questions = [];

  for (let i = 0; i < qdCount && offset < buf.length; i++) {
    const { name, bytesRead } = decodeDnsName(buf, offset);
    offset += bytesRead;
    if (offset + 4 <= buf.length) {
      const qtype = buf.readUInt16BE(offset);
      const qclass = buf.readUInt16BE(offset + 2) & 0x7fff;
      offset += 4;
      questions.push({ name, qtype, qclass });
    }
  }

  return { questions };
}

/**
 * Resolves local non-internal IPv4 network addresses.
 */
function getLocalIpv4Addresses() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  if (results.length === 0) {
    results.push('127.0.0.1');
  }
  return results;
}

class MdnsAdvertiser {
  constructor(options = {}) {
    this.port = options.port || 8766;
    this.name = options.name || `Soko (${os.hostname()})`;
    this.hostname = (os.hostname() || 'soko-desktop').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    this.version = options.version || '1.0.3';
    this.tls = Boolean(options.tls);
    this.certFingerprint = options.certFingerprint || '';
    this.ips = options.ips || getLocalIpv4Addresses();

    this.socket = null;
    this.isRunning = false;
    this.heartbeatTimer = null;
    this.isFallbackMode = false;
  }

  async start() {
    if (this.isRunning) return;

    return new Promise((resolve) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      this.socket = socket;

      socket.on('error', (err) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          console.warn(`[mDNS] Port 5353 occupied (${err.code}). Running in announcement fallback mode.`);
          this.isFallbackMode = true;
          socket.close();
          this._startFallbackBroadcast(resolve);
        } else {
          console.warn(`[mDNS Error] ${err.message}`);
        }
      });

      socket.on('message', (msg, rinfo) => {
        this._handleIncomingPacket(msg, rinfo);
      });

      socket.bind(MDNS_PORT, () => {
        try {
          socket.addMembership(MDNS_MULTICAST_ADDR);
          socket.setMulticastTTL(255);
          socket.setMulticastLoopback(true);
        } catch (e) {
          console.warn(`[mDNS] Multicast membership warning: ${e.message}`);
        }

        this.isRunning = true;
        this._sendAnnouncementBurst();
        this._startHeartbeat();
        resolve(true);
      });
    });
  }

  _startFallbackBroadcast(resolve) {
    const fallbackSocket = dgram.createSocket({ type: 'udp4' });
    this.socket = fallbackSocket;

    fallbackSocket.on('error', (err) => {
      console.warn(`[mDNS Fallback Socket Error] ${err.message}`);
    });

    fallbackSocket.bind(0, () => {
      try {
        fallbackSocket.setMulticastTTL(255);
      } catch {}
      this.isRunning = true;
      this._sendAnnouncementBurst();
      this._startHeartbeat();
      if (resolve) resolve(true);
    });
  }

  _getTxtRecords() {
    return {
      version: this.version,
      tls: this.tls ? '1' : '0',
      fp: this.certFingerprint,
      name: this.name,
      proto: 'soko-v1',
    };
  }

  _createPacket(ttl = 120) {
    return buildMdnsResponsePacket({
      instanceName: this.name,
      hostname: this.hostname,
      port: this.port,
      ips: this.ips,
      txtRecords: this._getTxtRecords(),
      ttl,
    });
  }

  _sendAnnouncementBurst() {
    if (!this.isRunning || !this.socket) return;
    const packet = this._createPacket(120);

    this._sendPacket(packet);
    setTimeout(() => {
      if (this.isRunning) this._sendPacket(packet);
    }, 250);
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isRunning) {
        this.ips = getLocalIpv4Addresses();
        const packet = this._createPacket(120);
        this._sendPacket(packet);
      }
    }, 60000);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _sendPacket(packet, port = MDNS_PORT, address = MDNS_MULTICAST_ADDR) {
    if (!this.socket) return;
    try {
      this.socket.send(packet, 0, packet.length, port, address, () => {});
    } catch {}
  }

  _handleIncomingPacket(msg, rinfo) {
    if (!this.isRunning) return;

    try {
      const { questions } = parseMdnsQuery(msg);
      if (!questions || questions.length === 0) return;

      const fqInstance = `${this.name}.${SERVICE_TYPE}`.toLowerCase();
      const targetHost = `${this.hostname}.local`.toLowerCase();

      let shouldRespond = false;
      for (const q of questions) {
        const qName = q.name.toLowerCase();
        if (
          qName === SERVICE_TYPE ||
          qName === DNS_SD_DISCOVERY ||
          qName === fqInstance ||
          qName === targetHost
        ) {
          shouldRespond = true;
          break;
        }
      }

      if (shouldRespond) {
        const responsePacket = this._createPacket(120);
        this._sendPacket(responsePacket, MDNS_PORT, MDNS_MULTICAST_ADDR);
      }
    } catch {}
  }

  updateAttributes(updates = {}) {
    if (updates.name) this.name = updates.name;
    if (updates.port) this.port = updates.port;
    if (typeof updates.tls === 'boolean') this.tls = updates.tls;
    if (updates.certFingerprint) this.certFingerprint = updates.certFingerprint;
    if (updates.ips) this.ips = updates.ips;

    if (this.isRunning) {
      this._sendAnnouncementBurst();
    }
  }

  stop() {
    if (!this.isRunning && !this.socket) return;
    this.isRunning = false;
    this._stopHeartbeat();

    if (this.socket) {
      try {
        const goodbye = this._createPacket(0);
        this.socket.send(goodbye, 0, goodbye.length, MDNS_PORT, MDNS_MULTICAST_ADDR, () => {
          try {
            if (!this.isFallbackMode) {
              this.socket.dropMembership(MDNS_MULTICAST_ADDR);
            }
          } catch {}
          try {
            this.socket.close();
          } catch {}
          this.socket = null;
        });
      } catch {
        try { this.socket.close(); } catch {}
        this.socket = null;
      }
    }
  }
}

module.exports = {
  encodeDnsName,
  decodeDnsName,
  encodeTxtRecord,
  buildMdnsResponsePacket,
  parseMdnsQuery,
  getLocalIpv4Addresses,
  MdnsAdvertiser,
};
