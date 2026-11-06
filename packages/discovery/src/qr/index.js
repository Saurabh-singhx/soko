/**
 * @file index.js
 * Dedicated Soko Universal QR Pairing Engine Module.
 */

const {
  InterfaceType,
  isVirtualInterface,
  classifyInterfaceType,
  resolveNetworkInterfaces,
} = require('./networkInterfaceResolver');

const {
  PairingMode,
  DEFAULT_TTL_SECONDS,
  buildUniversalQrPayload,
  parseUniversalQrPayload,
  escapeWifiString,
  unescapeWifiString,
} = require('./universalPairing');

const {
  validateQrSecurity,
  CLOCK_SKEW_TOLERANCE_SECONDS,
  MAX_EXPIRY_HORIZON_SECONDS,
} = require('./qrSecurityValidator');

module.exports = {
  // Enums & Constants
  InterfaceType,
  PairingMode,
  DEFAULT_TTL_SECONDS,
  CLOCK_SKEW_TOLERANCE_SECONDS,
  MAX_EXPIRY_HORIZON_SECONDS,

  // Network resolution
  isVirtualInterface,
  classifyInterfaceType,
  resolveNetworkInterfaces,

  // Payload building & parsing
  buildUniversalQrPayload,
  parseUniversalQrPayload,
  escapeWifiString,
  unescapeWifiString,

  // Security validation
  validateQrSecurity,
};
