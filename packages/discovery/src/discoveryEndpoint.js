/**
 * @file discoveryEndpoint.js
 * Handler & metadata generator for Soko Zero-Configuration HTTP discovery endpoints:
 * - GET /api/discovery
 * - GET /api/discovery/qr
 */

const os = require('os');
const { createPairingPayload } = require('./pairingPayload');
const { generateQrSvg } = require('./qrGenerator');
const { getLocalIpv4Addresses } = require('./mdnsAdvertiser');
const { resolveNetworkInterfaces } = require('./qr/networkInterfaceResolver');
const { buildUniversalQrPayload, escapeWifiString } = require('./qr/universalPairing');

/**
 * Builds the full discovery metadata payload.
 */
function buildDiscoveryMetadata(context = {}) {
  const port = context.port || 8766;
  const net = resolveNetworkInterfaces({ preferredIp: context.primaryIp });
  const addresses = context.addresses && context.addresses.length > 0
    ? context.addresses
    : (net.candidateIps.length > 0 ? net.candidateIps : getLocalIpv4Addresses());
  const primaryIp = addresses[0] || net.primaryIp || '127.0.0.1';
  const name = context.name || `Soko (${os.hostname()})`;
  const hostname = os.hostname();
  const sasPin = context.sasPin || '000000';
  const tls = Boolean(context.tls);
  const certFingerprint = context.certFingerprint || '';
  const paired = Boolean(context.paired);
  const version = context.version || '1.0.3';

  let pairingInfo = null;
  try {
    pairingInfo = createPairingPayload({
      host: primaryIp,
      port,
      pin: sasPin,
      fingerprint: certFingerprint,
      name,
      tls,
    });
  } catch (err) {
    pairingInfo = {
      uri: `soko://pair?host=${primaryIp}&port=${port}&pin=${sasPin}`,
      webUrl: `http://${primaryIp}:${port}/?pair=1&pin=${sasPin}`,
      qrPayload: `soko://pair?host=${primaryIp}&port=${port}&pin=${sasPin}`,
      pin: sasPin,
      formattedPin: sasPin,
    };
  }

  // Universal pairing payload with expiration and candidate fallback IPs
  let universalInfo = null;
  try {
    universalInfo = buildUniversalQrPayload({
      host: primaryIp,
      port,
      pin: sasPin,
      fingerprint: certFingerprint,
      name,
      tls,
      alts: net.alts,
      ttlSeconds: context.ttlSeconds || 300,
    });
  } catch {}

  return {
    service: 'soko',
    protocol: 'soko-v1',
    name,
    hostname,
    port,
    addresses,
    candidateAddresses: net.candidateIps,
    primaryAddress: primaryIp,
    primaryInterface: net.primaryInterface,
    alts: net.alts,
    version,
    tls,
    certFingerprint,
    requiresPairing: !paired,
    paired,
    pairingUri: pairingInfo.uri,
    webUrl: universalInfo ? universalInfo.webUrl : pairingInfo.webUrl,
    qrPayload: pairingInfo.qrPayload,
    universalQrPayload: universalInfo ? universalInfo.qrPayload : pairingInfo.webUrl,
    formattedPin: pairingInfo.formattedPin,
    expiresAt: universalInfo ? universalInfo.expiresAt : null,
    timestamp: Date.now(),
  };
}

/**
 * Handles HTTP requests for discovery metadata and QR SVG:
 * - GET /api/discovery
 * - GET /api/discovery/qr
 */
function handleDiscoveryHttpRequest(req, res, context = {}) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/discovery' && req.method === 'GET') {
    const metadata = buildDiscoveryMetadata(context);

    if (url.searchParams.get('format') === 'qr' || url.searchParams.get('format') === 'svg') {
      const mode = url.searchParams.get('mode');
      let targetPayload = metadata.pairingUri;
      if (mode === 'web' || mode === 'universal' || url.searchParams.get('universal') === '1') {
        targetPayload = metadata.universalQrPayload || metadata.webUrl;
      }
      const svg = generateQrSvg(targetPayload, {
        size: parseInt(url.searchParams.get('size'), 10) || 280,
        margin: 2,
        darkColor: '#000000',
        lightColor: '#ffffff',
      });
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(svg);
      return true;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(metadata, null, 2));
    return true;
  }

  if (url.pathname === '/api/discovery/qr' && req.method === 'GET') {
    const metadata = buildDiscoveryMetadata(context);
    const size = parseInt(url.searchParams.get('size'), 10) || 280;
    const mode = url.searchParams.get('mode');
    let targetPayload = metadata.pairingUri;
    if (mode === 'web' || mode === 'universal' || url.searchParams.get('universal') === '1') {
      targetPayload = metadata.universalQrPayload || metadata.webUrl;
    } else if (mode === 'wifi' && context.wifiSsid) {
      const escapedSsid = escapeWifiString(context.wifiSsid);
      const escapedPass = escapeWifiString(context.wifiPassword || '');
      targetPayload = `WIFI:S:${escapedSsid};T:${context.wifiPassword ? 'WPA' : 'nopass'};P:${escapedPass};;`;
    }

    const svg = generateQrSvg(targetPayload, {
      size,
      margin: 2,
      darkColor: '#000000',
      lightColor: '#ffffff',
    });
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(svg);
    return true;
  }

  return false;
}

module.exports = {
  buildDiscoveryMetadata,
  handleDiscoveryHttpRequest,
};
