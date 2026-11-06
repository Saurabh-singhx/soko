/**
 * @file universalPairing.js
 * Soko Universal Hybrid QR Code Generator & Payload Parser.
 *
 * Implements Option 3 (Hybrid Universal Model):
 * 1. Default Phone Camera: Generates a Universal Web URL (HTTP/HTTPS) that any standard
 *    smartphone camera (iOS Camera, Google Lens, Samsung Camera) opens seamlessly in the browser.
 * 2. Dedicated Mobile App: Native Flutter companion recognizes the universal URL, custom
 *    URI scheme (soko://pair), and Wi-Fi hotspot schemas, parsing credentials directly.
 * 3. Hotspot Mode: Generates standard WIFI:S:... schemas for AP isolation or outdoor use.
 * 4. Multi-Interface Resilience: Encodes alternative candidate IPs ('alts') for multi-homed PCs.
 * 5. Time-Sensitive Expiration: Includes Unix timestamp expiration ('exp') to prevent replay attacks.
 * 6. TLS Fingerprint Pinning: Embeds SHA-256 certificate fingerprints ('fp') to thwart MitM attacks.
 */

const { generateQrSvg, generateQrMatrix } = require('../qrGenerator');
const { resolveNetworkInterfaces } = require('./networkInterfaceResolver');

/**
 * QR Pairing mode types.
 * @enum {string}
 */
const PairingMode = {
  WEB: 'web',
  NATIVE: 'native',
  WIFI: 'wifi',
};

/**
 * Default pairing token Time-To-Live: 5 minutes (300 seconds).
 */
const DEFAULT_TTL_SECONDS = 300;

/**
 * Builds a standardized universal pairing payload and SVG QR matrix.
 *
 * @param {Object} options
 * @param {string} [options.host] - Workstation primary host IP address (auto-resolved if omitted)
 * @param {number|string} [options.port=8766] - Port of the Soko bridge daemon
 * @param {string} options.pin - 6-digit SAS pairing PIN
 * @param {string} [options.fingerprint=''] - SHA-256 TLS certificate fingerprint for client pinning
 * @param {string} [options.name=''] - Friendly workstation/device name
 * @param {boolean} [options.tls=false] - Whether server operates under TLS (HTTPS/WSS)
 * @param {'web'|'native'|'wifi'} [options.mode='web'] - Pairing format mode
 * @param {number} [options.ttlSeconds=300] - Expiration duration in seconds
 * @param {string|string[]} [options.alts] - Alternative candidate IP addresses
 * @param {string} [options.wifiSsid=''] - SSID for Wi-Fi hotspot mode
 * @param {string} [options.wifiPassword=''] - Password for Wi-Fi hotspot mode
 * @param {string} [options.wifiAuthType='WPA'] - Wi-Fi auth type ('WPA' | 'WEP' | 'nopass')
 * @param {Object} [options.qrOptions] - QR code rendering options (size, margin, colors)
 * @returns {{
 *   qrPayload: string,
 *   webUrl: string,
 *   nativeUri: string,
 *   wifiString: string|null,
 *   pin: string,
 *   formattedPin: string,
 *   expiresAt: number,
 *   ttlSeconds: number,
 *   mode: string,
 *   primaryIp: string,
 *   candidateIps: string[],
 *   alts: string,
 *   svg: string
 * }}
 */
function buildUniversalQrPayload(options = {}) {
  const {
    pin,
    port = 8766,
    fingerprint = '',
    name = '',
    tls = false,
    mode = PairingMode.WEB,
    ttlSeconds = DEFAULT_TTL_SECONDS,
    wifiSsid = '',
    wifiPassword = '',
    wifiAuthType = 'WPA',
    qrOptions = {},
  } = options;

  if (!pin) {
    throw new Error('A 6-digit SAS pairing PIN is required to generate pairing payload');
  }

  const cleanPin = String(pin).replace(/\D/g, '');
  if (cleanPin.length !== 6) {
    throw new Error(`PIN must be exactly 6 digits, received: "${pin}"`);
  }
  const formattedPin = `${cleanPin.slice(0, 3)} ${cleanPin.slice(3, 6)}`;

  // Resolve network interfaces if host is not explicitly provided
  let primaryIp = options.host;
  let candidateIps = [];
  let alts = '';

  if (!primaryIp) {
    const net = resolveNetworkInterfaces();
    primaryIp = net.primaryIp;
    candidateIps = net.candidateIps;
    alts = net.alts;
  } else {
    primaryIp = String(primaryIp).trim();
    if (options.alts) {
      alts = Array.isArray(options.alts) ? options.alts.join(',') : String(options.alts).trim();
      candidateIps = [primaryIp, ...alts.split(',').map((s) => s.trim()).filter(Boolean)];
    } else {
      candidateIps = [primaryIp];
    }
  }

  const cleanPort = parseInt(String(port), 10) || 8766;
  const cleanFp = String(fingerprint || '').trim();
  const cleanName = String(name || '').trim();
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = nowSec + ttlSeconds;

  // 1. Build Universal Web URL (Primary payload for standard phone cameras)
  const webParams = new URLSearchParams();
  webParams.set('pair', '1');
  webParams.set('pin', cleanPin);
  if (cleanFp) webParams.set('fp', cleanFp);
  if (cleanName) webParams.set('name', cleanName);
  webParams.set('exp', String(expiresAt));
  if (alts) webParams.set('alts', alts);
  webParams.set('v', '1');

  const scheme = tls ? 'https' : 'http';
  const webUrl = `${scheme}://${primaryIp}:${cleanPort}/?${webParams.toString()}`;

  // 2. Build Native Soko Deep Link URI
  const nativeParams = new URLSearchParams();
  nativeParams.set('host', primaryIp);
  nativeParams.set('port', String(cleanPort));
  nativeParams.set('pin', cleanPin);
  if (cleanFp) nativeParams.set('fp', cleanFp);
  if (cleanName) nativeParams.set('name', cleanName);
  nativeParams.set('tls', tls ? '1' : '0');
  nativeParams.set('exp', String(expiresAt));
  if (alts) nativeParams.set('alts', alts);
  nativeParams.set('v', '1');

  const nativeUri = `soko://pair?${nativeParams.toString()}`;

  // 3. Build Wi-Fi Hotspot Schema (for offline / AP isolation modes)
  let wifiString = null;
  if (wifiSsid) {
    const escapedSsid = escapeWifiString(wifiSsid);
    const escapedPass = escapeWifiString(wifiPassword);
    const auth = wifiPassword ? (wifiAuthType || 'WPA') : 'nopass';
    wifiString = `WIFI:S:${escapedSsid};T:${auth};P:${escapedPass};;`;
  }

  // 4. Select the target payload string based on requested mode
  let qrPayload = webUrl;
  if (mode === PairingMode.NATIVE) {
    qrPayload = nativeUri;
  } else if (mode === PairingMode.WIFI) {
    qrPayload = wifiString || webUrl;
  }

  // 5. Generate high-contrast SVG representation
  const defaultQrOpts = {
    size: 260,
    margin: 2,
    darkColor: '#0A0C14',
    lightColor: '#FFFFFF',
    ...qrOptions,
  };
  const svg = generateQrSvg(qrPayload, defaultQrOpts);

  return {
    qrPayload,
    webUrl,
    nativeUri,
    wifiString,
    pin: cleanPin,
    formattedPin,
    expiresAt,
    ttlSeconds,
    mode,
    primaryIp,
    candidateIps,
    alts,
    svg,
  };
}

/**
 * Escapes special characters in Wi-Fi barcode string (RFC format).
 * @param {string} str
 * @returns {string}
 */
function escapeWifiString(str) {
  if (!str) return '';
  return str.replace(/([\\;,":])/g, '\\$1');
}

/**
 * Unescapes special characters from Wi-Fi barcode string.
 * @param {string} str
 * @returns {string}
 */
function unescapeWifiString(str) {
  if (!str) return '';
  return str.replace(/\\([\\;,":])/g, '$1');
}

/**
 * Comprehensive Universal QR Parser.
 *
 * Edge cases handled:
 * - Scanned text from standard phone camera or mobile web companion.
 * - Universal Web URL (http://.../?pair=1&pin=...).
 * - Custom Scheme URI (soko://pair?host=...).
 * - Standard Wi-Fi configuration barcodes (WIFI:S:...).
 * - Raw numeric 6-digit PIN string ("482195" or "482 195").
 * - JSON encoded payload {"host": "...", "pin": "..."}.
 * - Expiration check against current wall-clock time with 30s clock skew tolerance.
 * - Alternative candidate IP list extraction.
 *
 * @param {string} input - Scanned QR code or URL string
 * @returns {{
 *   valid: boolean,
 *   mode: 'web'|'native'|'wifi'|'pin'|'unknown',
 *   host: string|null,
 *   port: number,
 *   pin: string|null,
 *   formattedPin: string|null,
 *   fingerprint: string|null,
 *   name: string|null,
 *   tls: boolean,
 *   expiresAt: number|null,
 *   isExpired: boolean,
 *   remainingSeconds: number|null,
 *   alts: string[],
 *   candidateIps: string[],
 *   wifi?: { ssid: string, password?: string, authType?: string },
 *   error?: string
 * }}
 */
function parseUniversalQrPayload(input) {
  if (!input || typeof input !== 'string') {
    return {
      valid: false,
      mode: 'unknown',
      host: null,
      port: 8766,
      pin: null,
      formattedPin: null,
      fingerprint: null,
      name: null,
      tls: false,
      expiresAt: null,
      isExpired: false,
      remainingSeconds: null,
      alts: [],
      candidateIps: [],
      error: 'Empty or invalid QR payload input',
    };
  }

  const trimmed = input.trim();
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Raw 6-Digit PIN check
  const pinMatch = trimmed.match(/^(\d{3})\s?(\d{3})$/);
  if (pinMatch) {
    const clean = `${pinMatch[1]}${pinMatch[2]}`;
    return {
      valid: true,
      mode: 'pin',
      host: null,
      port: 8766,
      pin: clean,
      formattedPin: `${clean.slice(0, 3)} ${clean.slice(3, 6)}`,
      fingerprint: null,
      name: null,
      tls: false,
      expiresAt: null,
      isExpired: false,
      remainingSeconds: null,
      alts: [],
      candidateIps: [],
    };
  }

  // 2. Wi-Fi Hotspot Schema check
  if (trimmed.startsWith('WIFI:')) {
    const ssidMatch = trimmed.match(/S:((?:\\;|[^;])+);/);
    const passMatch = trimmed.match(/P:((?:\\;|[^;])*);/);
    const typeMatch = trimmed.match(/T:([^;]+);/);

    if (ssidMatch) {
      const ssid = unescapeWifiString(ssidMatch[1]);
      const password = passMatch ? unescapeWifiString(passMatch[1]) : '';
      const authType = typeMatch ? typeMatch[1] : (password ? 'WPA' : 'nopass');

      return {
        valid: true,
        mode: PairingMode.WIFI,
        host: null,
        port: 8766,
        pin: null,
        formattedPin: null,
        fingerprint: null,
        name: null,
        tls: false,
        expiresAt: null,
        isExpired: false,
        remainingSeconds: null,
        alts: [],
        candidateIps: [],
        wifi: {
          ssid,
          password,
          authType,
        },
      };
    }
  }

  // 3. JSON Payload check
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const json = JSON.parse(trimmed);
      const cleanPin = String(json.pin || '').replace(/\D/g, '');
      const exp = json.exp ? parseInt(String(json.exp), 10) : null;
      const isExpired = exp ? (nowSec - 30 > exp) : false;

      return {
        valid: cleanPin.length === 6 && !isExpired,
        mode: 'web',
        host: json.host || null,
        port: parseInt(json.port, 10) || 8766,
        pin: cleanPin.length === 6 ? cleanPin : null,
        formattedPin: cleanPin.length === 6 ? `${cleanPin.slice(0, 3)} ${cleanPin.slice(3, 6)}` : null,
        fingerprint: json.fp || json.fingerprint || null,
        name: json.name || null,
        tls: Boolean(json.tls),
        expiresAt: exp,
        isExpired,
        remainingSeconds: exp ? Math.max(0, exp - nowSec) : null,
        alts: Array.isArray(json.alts) ? json.alts : (json.alts ? String(json.alts).split(',') : []),
        candidateIps: json.host ? [json.host, ...(Array.isArray(json.alts) ? json.alts : [])] : [],
        error: isExpired ? 'Pairing payload has expired' : undefined,
      };
    } catch {}
  }

  // 4. URL or URI Scheme check
  let searchParams;
  let parsedHost = null;
  let parsedPort = 8766;
  let isTls = false;
  let detectedMode = PairingMode.WEB;

  try {
    if (trimmed.startsWith('soko://pair')) {
      detectedMode = PairingMode.NATIVE;
      const parsedUrl = new URL(trimmed);
      searchParams = parsedUrl.searchParams;
      parsedHost = searchParams.get('host') || null;
      if (searchParams.has('port')) {
        parsedPort = parseInt(searchParams.get('port'), 10) || 8766;
      }
      isTls = searchParams.get('tls') === '1' || searchParams.get('tls') === 'true';
    } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      detectedMode = PairingMode.WEB;
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
      if (searchParams.has('tls')) {
        isTls = searchParams.get('tls') === '1' || searchParams.get('tls') === 'true';
      }
    } else if (trimmed.includes('pin=') || trimmed.includes('pair=')) {
      searchParams = new URLSearchParams(trimmed.startsWith('?') ? trimmed.slice(1) : trimmed);
      parsedHost = searchParams.get('host') || null;
      if (searchParams.has('port')) {
        parsedPort = parseInt(searchParams.get('port'), 10) || 8766;
      }
    } else {
      return {
        valid: false,
        mode: 'unknown',
        host: null,
        port: 8766,
        pin: null,
        formattedPin: null,
        fingerprint: null,
        name: null,
        tls: false,
        expiresAt: null,
        isExpired: false,
        remainingSeconds: null,
        alts: [],
        candidateIps: [],
        error: 'Unrecognized pairing QR payload format',
      };
    }
  } catch (err) {
    return {
      valid: false,
      mode: 'unknown',
      host: null,
      port: 8766,
      pin: null,
      formattedPin: null,
      fingerprint: null,
      name: null,
      tls: false,
      expiresAt: null,
      isExpired: false,
      remainingSeconds: null,
      alts: [],
      candidateIps: [],
      error: `Malformed pairing URL: ${err.message}`,
    };
  }

  // Extract query parameters
  const rawPin = searchParams.get('pin');
  const cleanPin = rawPin ? String(rawPin).replace(/\D/g, '') : null;
  const validPin = cleanPin && cleanPin.length === 6 ? cleanPin : null;
  const formattedPin = validPin ? `${validPin.slice(0, 3)} ${validPin.slice(3, 6)}` : null;

  const fingerprint = searchParams.get('fp') || searchParams.get('fingerprint') || null;
  const name = searchParams.get('name') ? decodeURIComponent(searchParams.get('name')) : null;

  // Expiration check with 30s clock-skew tolerance
  const rawExp = searchParams.get('exp');
  let expiresAt = null;
  let isExpired = false;
  let remainingSeconds = null;

  if (rawExp) {
    const expSec = parseInt(rawExp, 10);
    if (!isNaN(expSec) && expSec > 0) {
      expiresAt = expSec;
      isExpired = (nowSec - 30) > expSec;
      remainingSeconds = Math.max(0, expSec - nowSec);
    }
  }

  // Alternative candidate IPs
  const rawAlts = searchParams.get('alts');
  const alts = rawAlts
    ? rawAlts.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const candidateIps = parsedHost ? [parsedHost, ...alts] : alts;

  const isValid = Boolean(validPin && (parsedHost || alts.length > 0) && !isExpired);

  let error;
  if (!validPin) {
    error = 'Missing or invalid 6-digit pairing PIN';
  } else if (!parsedHost && alts.length === 0) {
    error = 'Missing workstation host IP address';
  } else if (isExpired) {
    error = `QR code pairing token has expired (${remainingSeconds}s remaining)`;
  }

  return {
    valid: isValid,
    mode: detectedMode,
    host: parsedHost,
    port: parsedPort,
    pin: validPin,
    formattedPin,
    fingerprint,
    name,
    tls: isTls,
    expiresAt,
    isExpired,
    remainingSeconds,
    alts,
    candidateIps,
    error,
  };
}

module.exports = {
  PairingMode,
  DEFAULT_TTL_SECONDS,
  buildUniversalQrPayload,
  parseUniversalQrPayload,
  escapeWifiString,
  unescapeWifiString,
};
