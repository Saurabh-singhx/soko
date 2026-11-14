/**
 * Route Security Classification & Declarative Policy Table
 *
 * Defines the security tiers, required permissions, and rate limiting policies
 * for all Soko HTTP endpoints.
 */

const ROUTE_POLICY = {
  PUBLIC: 'PUBLIC',         // Accessible by any client without authentication
  LOCAL_ONLY: 'LOCAL_ONLY', // Restricted to local desktop loopback (127.0.0.1 / ::1)
  PROTECTED: 'PROTECTED',   // Requires verified Bearer token or local loopback trust
};

const DEFAULT_ROUTES = [
  // --- Public Discovery, Status & Static Assets ---
  { path: '/api/discovery', methods: ['GET'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/api/discovery/qr', methods: ['GET'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/api/status', methods: ['GET'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/api/devices/scan', methods: ['GET'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/api/devices/discovered', methods: ['GET'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/', methods: ['GET', 'HEAD'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/mobile', methods: ['GET', 'HEAD'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/companion', methods: ['GET', 'HEAD'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/favicon.ico', methods: ['GET', 'HEAD'], policy: ROUTE_POLICY.PUBLIC },

  // --- Pairing & Authentication Endpoints ---
  { path: '/api/pair', methods: ['POST'], policy: ROUTE_POLICY.PUBLIC, rateLimited: true },
  { path: '/api/pair/status', methods: ['GET'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/api/auth/refresh', methods: ['POST'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/api/pair/refresh', methods: ['POST'], policy: ROUTE_POLICY.PUBLIC },

  // --- Local-Only Desktop SAS PIN & Device Approval ---
  { path: '/api/devices/pending-pin', methods: ['GET', 'POST'], policy: ROUTE_POLICY.LOCAL_ONLY },
  { path: '/api/devices/regenerate-pin', methods: ['POST'], policy: ROUTE_POLICY.LOCAL_ONLY },
  { path: '/api/devices/pending-pair', methods: ['GET'], policy: ROUTE_POLICY.LOCAL_ONLY },
  { path: '/api/devices/pair-select', methods: ['POST'], policy: ROUTE_POLICY.LOCAL_ONLY },
  { path: '/api/devices/unpair', methods: ['POST'], policy: ROUTE_POLICY.LOCAL_ONLY },
  { path: '/api/unpair', methods: ['POST'], policy: ROUTE_POLICY.LOCAL_ONLY },

  // --- Protected AI Telemetry & Remote Agent Endpoints ---
  { path: '/api/tokens', methods: ['GET'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:read'] },
  { path: '/api/agent-activity', methods: ['GET'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:read'] },
  { path: '/api/agent-sessions', methods: ['GET'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:read'] },
  { path: '/api/agent-activity/simulate', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED },
  { path: '/api/agent/sessions', methods: ['GET', 'POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:read'] },
  { path: '/api/agent/transcript', methods: ['GET', 'POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:read'] },
  { path: '/api/agent/prompt', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:write'] },

  // --- Protected Notifications & CLI Commands ---
  { path: '/api/notify', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:write'] },
  { path: '/api/cli', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['cli:execute'] },

  // --- Protected Transfers & Storage ---
  { path: '/api/transfer', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:write'] },
  { path: '/api/transfer/cancel', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:write'] },
  { path: '/api/transfer/retry', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:write'] },
  { path: '/api/upload', methods: ['POST', 'PUT'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:write'], isUpload: true },
  { path: '/api/transfers', methods: ['GET'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:read'] },
  { path: '/api/transfers/open', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:write'] },
  { path: '/api/transfers/download', methods: ['GET', 'HEAD'], policy: ROUTE_POLICY.PROTECTED },
  { path: '/transfers/*', methods: ['GET', 'HEAD'], policy: ROUTE_POLICY.PROTECTED }, // Note: /transfers/music/* is special-cased as PUBLIC

  // --- Audio Engine & Session Revocation ---
  { path: '/api/audio/status', methods: ['GET'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/api/audio/stream', methods: ['GET', 'HEAD'], policy: ROUTE_POLICY.PROTECTED },
  { path: '/api/audio/control', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:write'] },
  { path: '/api/audio/mute-speaker', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:write'] },
  { path: '/api/audio/settings', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:write'] },
  { path: '/api/music/now-playing', methods: ['GET', 'POST'], policy: ROUTE_POLICY.PUBLIC },
  { path: '/api/git/event', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED },
  { path: '/api/auth/revoke-all', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:admin'] },
  { path: '/api/devices/revoke-all', methods: ['POST'], policy: ROUTE_POLICY.PROTECTED, permissions: ['companion:admin'] },
];

/**
 * Classifies an incoming request method and pathname against security rules.
 *
 * @param {string} method - HTTP method (e.g. GET, POST)
 * @param {string} pathname - URL pathname
 * @param {Array<object>} [customRoutes] - Optional route overrides
 * @returns {object} { policy, rateLimited, permissions, isUpload }
 */
function classifyRoute(method, pathname, customRoutes = DEFAULT_ROUTES) {
  const normMethod = (method || 'GET').toUpperCase();
  const normPath = pathname || '/';

  // Special-case: /transfers/music/* is public audio cache
  if (normPath.startsWith('/transfers/music/')) {
    return {
      policy: ROUTE_POLICY.PUBLIC,
      rateLimited: false,
      permissions: [],
      isUpload: false,
    };
  }

  // Exact match
  for (const route of customRoutes) {
    if (route.path === normPath && (!route.methods || route.methods.includes(normMethod))) {
      return {
        policy: route.policy,
        rateLimited: Boolean(route.rateLimited),
        permissions: route.permissions || [],
        isUpload: Boolean(route.isUpload),
      };
    }
  }

  // Prefix wildcard match (e.g. /transfers/*)
  for (const route of customRoutes) {
    if (route.path.endsWith('/*')) {
      const prefix = route.path.slice(0, -2);
      if (normPath.startsWith(prefix) && (!route.methods || route.methods.includes(normMethod))) {
        return {
          policy: route.policy,
          rateLimited: Boolean(route.rateLimited),
          permissions: route.permissions || [],
          isUpload: Boolean(route.isUpload),
        };
      }
    }
  }

  // Static web companion assets (e.g. /styles.css, /bundle.js) are PUBLIC
  if ((normMethod === 'GET' || normMethod === 'HEAD') && !normPath.startsWith('/api/') && !normPath.startsWith('/transfers/')) {
    return {
      policy: ROUTE_POLICY.PUBLIC,
      rateLimited: false,
      permissions: [],
      isUpload: false,
    };
  }

  // Default fallback for unspecified /api routes: PROTECTED (Zero-Trust principle)
  return {
    policy: ROUTE_POLICY.PROTECTED,
    rateLimited: false,
    permissions: [],
    isUpload: false,
  };
}

module.exports = {
  ROUTE_POLICY,
  DEFAULT_ROUTES,
  classifyRoute,
};
