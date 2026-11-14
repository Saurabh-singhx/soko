/**
 * Role-Based Access Control (RBAC) & Endpoint Policy Enforcement Stage
 *
 * Enforces route tier policies (PUBLIC, LOCAL_ONLY, PROTECTED), checks required
 * scopes/permissions, and validates CLI command execution against the strict security whitelist.
 */

const { UnauthorizedError, ForbiddenError } = require('../core/errors');
const { ROUTE_POLICY, classifyRoute } = require('../routing/routes');

const DEFAULT_CLI_WHITELIST = new Set([
  'sysinfo',
  'mem',
  'disk',
  'top-procs',
  'battery',
  'net-stats',
  'ports',
  'git-status',
  'status',
  'agy-status',
  'test',
  'agy-test',
]);

/**
 * Creates the RBAC authorization middleware stage.
 *
 * @param {object} [options]
 * @param {Array<object>} [options.routes] - Optional custom route definitions
 * @param {Set<string>} [options.cliWhitelist] - Whitelisted CLI commands
 * @returns {Function} (ctx, next) => Promise<void>
 */
function createRbacStage(options = {}) {
  const cliWhitelist = options.cliWhitelist || DEFAULT_CLI_WHITELIST;
  const customRoutes = options.routes;

  return async function rbacStage(ctx, next) {
    const routeInfo = classifyRoute(ctx.method, ctx.pathname, customRoutes);

    // 1. PUBLIC Endpoints: Always accessible
    if (routeInfo.policy === ROUTE_POLICY.PUBLIC) {
      await next();
      return;
    }

    // 2. LOCAL_ONLY Endpoints: Strictly loopback desktop
    if (routeInfo.policy === ROUTE_POLICY.LOCAL_ONLY) {
      if (!ctx.isLoopback) {
        throw new ForbiddenError(
          'Forbidden: Endpoint is restricted to local desktop loopback.',
          'LOCAL_ONLY_REQUIRED',
          { code: 403 }
        );
      }
      await next();
      return;
    }

    // 3. PROTECTED Endpoints: Requires authenticated caller (loopback or valid bearer token)
    if (routeInfo.policy === ROUTE_POLICY.PROTECTED) {
      if (!ctx.auth || !ctx.auth.authenticated) {
        const isExpired = Boolean(ctx.auth && ctx.auth.tokenExpired);
        if (isExpired) {
          throw new UnauthorizedError(
            'Unauthorized: Bearer token has expired after 30 days. Complete PIN pairing on Desktop Island first.',
            'TOKEN_EXPIRED',
            { tokenExpired: true, requiresPairing: true }
          );
        } else {
          throw new UnauthorizedError(
            'Unauthorized: Remote device is not paired or missing valid bearer token. Complete PIN pairing on Desktop Island first.',
            'UNAUTHORIZED',
            { tokenExpired: false, requiresPairing: true }
          );
        }
      }

      // Check required permissions/scopes if specified
      if (routeInfo.permissions && routeInfo.permissions.length > 0) {
        const userPerms = ctx.auth.permissions || new Set();
        const isAdmin = userPerms.has('*') || ctx.auth.role === 'admin';

        if (!isAdmin) {
          for (const requiredPerm of routeInfo.permissions) {
            if (!userPerms.has(requiredPerm)) {
              throw new ForbiddenError(
                `Forbidden: Insufficient permissions for endpoint (${requiredPerm} required)`,
                'INSUFFICIENT_PERMISSIONS',
                { code: 403, required: requiredPerm }
              );
            }
          }
        }
      }
    }

    // 4. CLI Whitelist Guard: Enforce strict command whitelist for /api/cli
    if (ctx.pathname === '/api/cli' && ctx.method === 'POST') {
      const command = ctx.body && ctx.body.command;
      if (command && !cliWhitelist.has(command)) {
        throw new ForbiddenError(
          `Security violation: Command '${command}' not permitted in execution whitelist.`,
          'COMMAND_NOT_WHITELISTED',
          { code: 403, exitCode: 403 }
        );
      }
    }

    await next();
  };
}

module.exports = {
  createRbacStage,
  DEFAULT_CLI_WHITELIST,
};
