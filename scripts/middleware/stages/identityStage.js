/**
 * Identity & TrustStore Verification Middleware Stage
 *
 * Verifies that the authenticated device record still exists in TrustStore
 * (guarding against concurrent device unpairing or credential revocation) and
 * binds the live device entity to ctx.device.
 */

/**
 * Creates the Identity verification middleware stage.
 *
 * @param {object} options
 * @param {import('../../../packages/security').TrustStore} [options.trustStore]
 * @returns {Function} (ctx, next) => Promise<void>
 */
function createIdentityStage(options = {}) {
  const trustStore = options.trustStore;

  return async function identityStage(ctx, next) {
    if (ctx.auth && ctx.auth.authenticated && ctx.auth.authType === 'bearer' && ctx.auth.deviceId && trustStore) {
      const device = trustStore.get(ctx.auth.deviceId);
      if (device) {
        ctx.device = device;
      } else {
        // Device record was deleted or forgotten from TrustStore
        ctx.auth.authenticated = false;
        ctx.auth.role = 'anonymous';
        ctx.auth.permissions = new Set();
        ctx.device = null;
      }
    }

    await next();
  };
}

module.exports = {
  createIdentityStage,
};
