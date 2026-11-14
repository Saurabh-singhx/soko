/**
 * Asynchronous Onion / Chain Pipeline Engine for Soko Middleware
 *
 * Implements a composable (ctx, next) => Promise<void> execution model with
 * short-circuiting, comprehensive error boundary, and lifecycle telemetry.
 */

const { HttpError } = require('./errors');

class Pipeline {
  /**
   * @param {object} [options]
   * @param {((ctx: any) => void)} [options.onRequest]
   * @param {((ctx: any, durationMs: number) => void)} [options.onResponse]
   * @param {((err: Error, ctx: any) => void)} [options.onError]
   */
  constructor(options = {}) {
    this.stages = [];
    this.options = options;
  }

  /**
   * Appends one or more middleware stage functions to the execution pipeline.
   *
   * @param {Function | Function[]} stage - async (ctx, next) => Promise<void>
   * @returns {this}
   */
  use(stage) {
    if (Array.isArray(stage)) {
      for (const s of stage) {
        this.use(s);
      }
      return this;
    }
    if (typeof stage !== 'function') {
      throw new TypeError(`Pipeline middleware must be a function, received ${typeof stage}`);
    }
    this.stages.push(stage);
    return this;
  }

  /**
   * Executes the middleware pipeline for a given RequestContext.
   *
   * @param {import('./Context').RequestContext} ctx
   * @param {((ctx: import('./Context').RequestContext) => Promise<void> | void)} [finalHandler]
   * @returns {Promise<void>}
   */
  async execute(ctx, finalHandler = null) {
    if (typeof this.options.onRequest === 'function') {
      try {
        this.options.onRequest(ctx);
      } catch (err) {
        // Telemetry hook error should not disrupt pipeline
      }
    }

    let currentIndex = -1;

    const dispatch = async (index) => {
      // Prevent multiple next() calls from the same stage
      if (index <= currentIndex) {
        throw new Error(`next() called multiple times in pipeline stage at index ${index}`);
      }
      currentIndex = index;

      // Check if response has already been committed or pipeline short-circuited
      if (ctx.sent || (ctx.res && ctx.res.writableEnded)) {
        return;
      }

      if (index < this.stages.length) {
        const stage = this.stages[index];
        let nextCalled = false;
        await stage(ctx, async () => {
          nextCalled = true;
          await dispatch(index + 1);
        });
        return;
      }

      // All middleware stages executed; invoke optional final route handler
      if (finalHandler && !ctx.sent && !(ctx.res && ctx.res.writableEnded)) {
        await finalHandler(ctx);
      }
    };

    try {
      await dispatch(0);
    } catch (err) {
      if (typeof this.options.onError === 'function') {
        try {
          this.options.onError(err, ctx);
        } catch {}
      }

      // Handle HTTP error boundary if response not yet sent
      if (!ctx.sent && !(ctx.res && ctx.res.writableEnded)) {
        if (err instanceof HttpError || (typeof err.statusCode === 'number')) {
          ctx.sendError(err.statusCode || 500, err.message, err.code, err.extra || {});
        } else {
          ctx.sendError(500, 'Internal Server Error', 'INTERNAL_SERVER_ERROR', {
            message: err.message,
          });
        }
      } else {
        // Re-throw if response was already sent or cannot be handled cleanly
        throw err;
      }
    } finally {
      if (typeof this.options.onResponse === 'function') {
        try {
          const durationNs = process.hrtime.bigint() - ctx.startTime;
          const durationMs = Number(durationNs) / 1e6;
          this.options.onResponse(ctx, durationMs);
        } catch {}
      }
    }
  }
}

/**
 * Factory for creating a Pipeline instance
 *
 * @param {object} [options]
 * @returns {Pipeline}
 */
function createPipeline(options = {}) {
  return new Pipeline(options);
}

module.exports = {
  Pipeline,
  createPipeline,
};
