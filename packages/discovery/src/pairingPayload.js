/**
 * @file pairingPayload.js
 * Standardized URI & payload serializer/parser for Soko zero-configuration pairing.
 *
 * Supported formats:
 * - Native Soko URI:  soko://pair?host=192.168.1.5&port=8766&pin=482195&fp=SHA256:...&name=Workstation&tls=1
 * - Web Companion:   http://192.168.1.5:8766/?pair=1&pin=482195&fp=SHA256:...&name=Workstation
 */

/**
 * Creates standardized pairing URLs and QR payload.
 *
 * @param {Object} options
 * @param {string} options.host - Primary local IP address or hostname
 * @param {number|string} [options.port=8766] - Port of the Soko bridge server
 * @param {string} options.pin - 6-digit SAS pairing PIN
 * @param {string} [options.fingerprint=''] - SHA-256 certificate fingerprint for TLS pinning
 * @param {string} [options.name=''] - Friendly device/workstation name
 * @param {boolean} [options.tls=false] - Whether TLS is active on the server
 * @returns {{ uri: string, webUrl: string, qrPayload: string, pin: string, formattedPin: string }}
 */
function createPairingPayload({
  host,
  port = 8766,
  pin,
  fingerprint = '',
  name = '',
  tls = false,
}) {
  if (!host) {
    throw new Error('Host is required to generate pairing payload');
  }
  if (!pin) {
    throw new Error('PIN is required to generate pairing payload');
  }

  const cleanPin = String(pin).replace(/\D/g, '');
  if (cleanPin.length !== 6) {
    throw new Error(`PIN must be exactly 6 digits, got: "${pin}"`);
  }

  const formattedPin = `${cleanPin.slice(0, 3)} ${cleanPin.slice(3, 6)}`;
  const cleanPort = parseInt(String(port), 10) || 8766;
  const cleanFp = String(fingerprint || '').trim();
  const cleanName = String(name || '').trim();
  const tlsFlag = tls ? '1' : '0';

  const params = new URLSearchParams();
  params.set('host', host);
  params.set('port', String(cleanPort));
  params.set('pin', cleanPin);
  if (cleanFp) params.set('fp', cleanFp);
  if (cleanName) params.set('name', cleanName);
  params.set('tls', tlsFlag);

  const uri = `soko://pair?${params.toString()}`;

  const webParams = new URLSearchParams();
  webParams.set('pair', '1');
  webParams.set('pin', cleanPin);
  if (cleanFp) webParams.set('fp', cleanFp);
  if (cleanName) webParams.set('name', cleanName);

  const scheme = tls ? 'https' : 'http';
  const webUrl = `${scheme}://${host}:${cleanPort}/?${webParams.toString()}`;

  return {
    uri,
    webUrl,
    qrPayload: uri,
    pin: cleanPin,
    formattedPin,
  };
}

/**
 * Parses a pairing URI or URL string into structured connection options.
 *
 * @param {string} input - soko://pair?... or http://... or query string
 * @returns {{
 *   valid: boolean,
 *   host: string|null,
 *   port: number,
 *   pin: string|null,
 *   formattedPin: string|null,
 *   fingerprint: string|null,
 *   name: string|null,
 *   tls: boolean,
 *   error?: string
 * }}
 */
function parsePairingPayload(input) {
  if (!input || typeof input !== 'string') {
    return {
      valid: false,
      host: null,
      port: 8766,
      pin: null,
      formattedPin: null,
      fingerprint: null,
      name: null,
      tls: false,
      error: 'Empty or invalid input',
    };
  }

  const trimmed = input.trim();
  let searchParams;
  let parsedHost = null;
  let parsedPort = 8766;
  let isTls = false;

  try {
    if (trimmed.startsWith('soko://pair')) {
      const parsedUrl = new URL(trimmed);
      searchParams = parsedUrl.searchParams;
      parsedHost = searchParams.get('host') || null;
      if (searchParams.has('port')) {
        parsedPort = parseInt(searchParams.get('port'), 10) || 8766;
      }
    } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parsedUrl = new URL(trimmed);
      searchParams = parsedUrl.searchParams;
      parsedHost = parsedUrl.hostname;
      parsedPort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === 'https:' ? 443 : 80);
      isTls = parsedUrl.protocol === 'https:';
      if (searchParams.has('host')) {
        parsedHost = searchParams.get('host');
      }
      if (searchParams.has('port')) {
        parsedPort = parseInt(searchParams.get('port'), 10) || parsedPort;
      }
    } else if (trimmed.includes('pin=') || trimmed.includes('host=')) {
      searchParams = new URLSearchParams(trimmed.startsWith('?') ? trimmed.slice(1) : trimmed);
      parsedHost = searchParams.get('host') || null;
      if (searchParams.has('port')) {
        parsedPort = parseInt(searchParams.get('port'), 10) || 8766;
      }
    } else {
      return {
        valid: false,
        host: null,
        port: 8766,
        pin: null,
        formattedPin: null,
        fingerprint: null,
        name: null,
        tls: false,
        error: 'Unrecognized pairing URI scheme or format',
      };
    }
  } catch (err) {
    return {
      valid: false,
      host: null,
      port: 8766,
      pin: null,
      formattedPin: null,
      fingerprint: null,
      name: null,
      tls: false,
      error: `Failed to parse URL: ${err.message}`,
    };
  }

  const rawPin = (searchParams.get('pin') || '').replace(/\D/g, '');
  if (!rawPin || rawPin.length !== 6) {
    return {
      valid: false,
      host: parsedHost,
      port: parsedPort,
      pin: null,
      formattedPin: null,
      fingerprint: null,
      name: null,
      tls: false,
      error: 'Invalid or missing 6-digit PIN in payload',
    };
  }

  if (!parsedHost) {
    return {
      valid: false,
      host: null,
      port: parsedPort,
      pin: rawPin,
      formattedPin: `${rawPin.slice(0, 3)} ${rawPin.slice(3, 6)}`,
      fingerprint: null,
      name: null,
      tls: false,
      error: 'Missing host address in payload',
    };
  }

  if (searchParams.has('tls')) {
    isTls = searchParams.get('tls') === '1' || searchParams.get('tls') === 'true';
  }

  const fingerprint = searchParams.get('fp') || searchParams.get('fingerprint') || null;
  const name = searchParams.get('name') || null;
  const formattedPin = `${rawPin.slice(0, 3)} ${rawPin.slice(3, 6)}`;

  return {
    valid: true,
    host: parsedHost,
    port: parsedPort,
    pin: rawPin,
    formattedPin,
    fingerprint,
    name,
    tls: isTls,
  };
}

module.exports = {
  createPairingPayload,
  parsePairingPayload,
};
