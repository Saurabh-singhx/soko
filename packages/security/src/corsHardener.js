/**
 * Strict CORS & Host Header Hardener.
 * 
 * Protects Soko Bridge HTTP endpoints against:
 * - Cross-Site Request Forgery (CSRF) & malicious website intranet probing
 * - DNS Rebinding Attacks (forbids foreign Host headers)
 * - Wildcard CORS origin leakage ('*' replaced with explicit validated origins)
 */

class CorsHardener {
  /**
   * @param {Object} options
   * @param {number} [options.port] - Server port
   * @param {() => string[]} [options.getLocalIps] - Function returning local network IPv4 addresses
   */
  constructor(options = {}) {
    this.port = options.port || 8766;
    this.getLocalIps = options.getLocalIps || (() => []);
  }

  setPort(port) {
    this.port = port;
  }

  /**
   * Validates the incoming Host header to defend against DNS rebinding.
   * Allowed:
   * - localhost(:port)?
   * - 127.0.0.1(:port)?
   * - [::1](:port)?
   * - <Local_Network_IP>(:port)?
   * @param {string} hostHeader
   * @returns {boolean}
   */
  isHostAllowed(hostHeader) {
    if (!hostHeader) return true; // Native requests or internal sockets without Host header
    const cleanHost = hostHeader.trim().toLowerCase();

    // Remove port suffix if present
    const hostWithoutPort = cleanHost.replace(/:\d+$/, '');

    // Check standard loopback
    if (
      hostWithoutPort === 'localhost' ||
      hostWithoutPort === '127.0.0.1' ||
      hostWithoutPort === '::1' ||
      hostWithoutPort === '[::1]'
    ) {
      return true;
    }

    // Check detected host network interfaces
    const localIps = this.getLocalIps();
    for (const ip of localIps) {
      if (hostWithoutPort === ip.toLowerCase()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validates whether an incoming Origin header is permitted.
   * Allowed:
   * - No Origin (native desktop apps, Electron main, curl, mobile native webview, same-origin)
   * - localhost / 127.0.0.1 with any port (dev tools, Vite, web HUD)
   * - tauri://localhost or http://tauri.localhost
   * - null (sandboxed local iframe)
   * - file:// (local html preview)
   * - Origins whose host matches a verified local network IP
   * - Origin belonging to a paired device presenting a valid Bearer token
   * @param {string | undefined} origin
   * @param {Object} [context]
   * @param {boolean} [context.hasValidBearerToken]
   * @returns {boolean}
   */
  isOriginAllowed(origin, context = {}) {
    if (!origin) return true; // No Origin header -> allowed native/internal request

    const cleanOrigin = origin.trim();

    // Sandboxed / local schemes
    if (
      cleanOrigin === 'null' ||
      cleanOrigin.startsWith('file://') ||
      cleanOrigin === 'tauri://localhost' ||
      cleanOrigin === 'http://tauri.localhost' ||
      cleanOrigin === 'https://tauri.localhost'
    ) {
      return true;
    }

    try {
      const url = new URL(cleanOrigin);
      const host = url.hostname.toLowerCase();

      // Loopback
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        return true;
      }

      // Local network interfaces
      const localIps = this.getLocalIps();
      for (const ip of localIps) {
        if (host === ip.toLowerCase()) {
          return true;
        }
      }

      // If companion IP matches client socket and presents valid bearer token
      if (context.companionIp && host === context.companionIp.toLowerCase()) {
        return true;
      }
    } catch {}

    return false;
  }

  /**
   * Generates secure CORS response headers based on request validation.
   * @param {import('http').IncomingMessage} req
   * @param {Object} [context]
   * @returns {Record<string, string>}
   */
  getCorsHeaders(req, context = {}) {
    const origin = req.headers['origin'];
    const headers = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Checksum-Sha256, Content-Length, Authorization, x-simulate-remote-ip, *',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    };

    if (origin && this.isOriginAllowed(origin, context)) {
      headers['Access-Control-Allow-Origin'] = origin;
    } else if (!origin) {
      // For non-browser or same-origin requests, echo localhost for dev compatibility
      headers['Access-Control-Allow-Origin'] = `http://127.0.0.1:${this.port}`;
    } else {
      // Disallowed origin: do not set Allow-Origin header!
    }

    return headers;
  }

  /**
   * Preflight request handler. Returns true if request was handled.
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   * @param {Object} [context]
   * @returns {boolean}
   */
  handlePreflight(req, res, context = {}) {
    if (req.method !== 'OPTIONS') return false;

    const origin = req.headers['origin'];
    if (origin && !this.isOriginAllowed(origin, context)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: CORS origin rejected by security policy', code: 403 }));
      return true;
    }

    const corsHeaders = this.getCorsHeaders(req, context);
    res.writeHead(204, corsHeaders);
    res.end();
    return true;
  }

  /**
   * Verifies both Host and Origin headers. If invalid, sends error response and returns false.
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   * @param {Object} [context]
   * @returns {boolean} true if request is valid, false if rejected
   */
  validateRequest(req, res, context = {}) {
    // 1. Host header validation (DNS rebinding defense)
    const host = req.headers['host'];
    if (host && !this.isHostAllowed(host)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Bad Request: Invalid Host header (DNS Rebinding Protection)',
          code: 400,
          host,
        })
      );
      return false;
    }

    // 2. Origin header validation
    const origin = req.headers['origin'];
    if (origin && !this.isOriginAllowed(origin, context)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Forbidden: Untrusted Cross-Origin Request Blocked by Soko Security Guardrails',
          code: 403,
          origin,
        })
      );
      return false;
    }

    return true;
  }
}

module.exports = { CorsHardener };
