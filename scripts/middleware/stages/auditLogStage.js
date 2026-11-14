/**
 * Audit Logging & Security Telemetry Middleware Stage
 *
 * Measures high-resolution request execution latency and logs structured events
 * and security alerts to RollingFileLogger (with fallback to console).
 */

/**
 * Creates the Audit Logging middleware stage.
 *
 * @param {object} [options]
 * @param {import('../../../packages/logger').RollingFileLogger | Console} [options.logger]
 * @returns {Function} (ctx, next) => Promise<void>
 */
function createAuditLogStage(options = {}) {
  const logger = options.logger || console;

  function logInfo(message) {
    if (typeof logger.info === 'function') {
      logger.info(message);
    } else if (typeof logger.log === 'function') {
      logger.log(`[INFO] ${message}`);
    }
  }

  function logWarn(message) {
    if (typeof logger.warn === 'function') {
      logger.warn(message);
    } else if (typeof logger.log === 'function') {
      logger.log(`[WARN] ${message}`);
    }
  }

  function logError(message) {
    if (typeof logger.error === 'function') {
      logger.error(message);
    } else if (typeof logger.log === 'function') {
      logger.log(`[ERROR] ${message}`);
    }
  }

  return async function auditLogStage(ctx, next) {
    try {
      await next();

      const durationNs = process.hrtime.bigint() - ctx.startTime;
      const durationMs = (Number(durationNs) / 1e6).toFixed(2);
      const statusCode = ctx.res.statusCode || 200;

      logInfo(`[${ctx.reqId}] ${ctx.clientIp} ${ctx.method} ${ctx.pathname} -> ${statusCode} (${durationMs}ms)`);
    } catch (err) {
      const durationNs = process.hrtime.bigint() - ctx.startTime;
      const durationMs = (Number(durationNs) / 1e6).toFixed(2);
      const statusCode = err.statusCode || 500;

      if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
        logWarn(`[${ctx.reqId}] Security Rejection: ${ctx.clientIp} ${ctx.method} ${ctx.pathname} -> ${statusCode} (${err.message}) (${durationMs}ms)`);
      } else {
        logError(`[${ctx.reqId}] Pipeline Error: ${ctx.clientIp} ${ctx.method} ${ctx.pathname} -> ${statusCode} (${err.message}) (${durationMs}ms)`);
      }

      throw err;
    }
  };
}

module.exports = {
  createAuditLogStage,
};
