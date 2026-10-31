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

  // HTTP Discovery endpoint
  buildDiscoveryMetadata,
  handleDiscoveryHttpRequest,
};
