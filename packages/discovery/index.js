/**
 * @file index.js
 * Public entrypoint for @soko/discovery package (CommonJS + TS declarations).
 */

const {
  MdnsAdvertiser,
  encodeDnsName,
  decodeDnsName,
  encodeTxtRecord,
  buildMdnsResponsePacket,
  parseMdnsQuery,
  getLocalIpv4Addresses,
} = require('./src/mdnsAdvertiser');

const {
  generateQrMatrix,
  generateQrSvg,
  generateQrDataUrl,
} = require('./src/qrGenerator');

const {
  createPairingPayload,
  parsePairingPayload,
} = require('./src/pairingPayload');

const {
  buildDiscoveryMetadata,
  handleDiscoveryHttpRequest,
} = require('./src/discoveryEndpoint');

// Dedicated Universal QR Pairing Engine
const qr = require('./src/qr');
const {
  buildUniversalQrPayload,
  parseUniversalQrPayload,
  resolveNetworkInterfaces,
  classifyInterfaceType,
  isVirtualInterface,
  validateQrSecurity,
  PairingMode,
  InterfaceType,
  escapeWifiString,
  unescapeWifiString,
} = qr;

module.exports = {
  // mDNS / Zeroconf
  MdnsAdvertiser,
  encodeDnsName,
  decodeDnsName,
  encodeTxtRecord,
  buildMdnsResponsePacket,
  parseMdnsQuery,
  getLocalIpv4Addresses,

  // QR Code generator
  generateQrMatrix,
  generateQrSvg,
  generateQrDataUrl,

  // Pairing payload & URI format
  createPairingPayload,
  parsePairingPayload,

  // Universal QR Pairing Engine (Option 3 Dedicated Module)
  qr,
  buildUniversalQrPayload,
  parseUniversalQrPayload,
  resolveNetworkInterfaces,
  classifyInterfaceType,
  isVirtualInterface,
  validateQrSecurity,
  PairingMode,
  InterfaceType,
  escapeWifiString,
  unescapeWifiString,

  // HTTP Discovery endpoint
  buildDiscoveryMetadata,
  handleDiscoveryHttpRequest,
};
