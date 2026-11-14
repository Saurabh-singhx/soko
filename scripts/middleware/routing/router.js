/**
 * Declarative Router for Soko Server Endpoints
 *
 * Provides expressive method & pathname registration, parameter extraction,
 * and dispatching for RequestContext.
 */

class Router {
  constructor() {
    this.routes = [];
  }

  /**
   * Registers a route pattern.
   *
   * @param {string} method - 'GET', 'POST', 'PUT', 'DELETE', or '*'
   * @param {string} pattern - Exact path or pattern with wildcard (e.g. '/transfers/*')
   * @param {Function} handler - async (ctx) => Promise<void> | void
   */
  register(method, pattern, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`Route handler for ${method} ${pattern} must be a function`);
    }

    const isWildcard = pattern.endsWith('/*');
    const basePath = isWildcard ? pattern.slice(0, -2) : pattern;

    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      isWildcard,
      basePath,
      handler,
    });
  }

  get(pattern, handler) {
    this.register('GET', pattern, handler);
    return this;
  }

  post(pattern, handler) {
    this.register('POST', pattern, handler);
    return this;
  }

  put(pattern, handler) {
    this.register('PUT', pattern, handler);
    return this;
  }

  delete(pattern, handler) {
    this.register('DELETE', pattern, handler);
    return this;
  }

  all(pattern, handler) {
    this.register('*', pattern, handler);
    return this;
  }

  /**
   * Matches an incoming RequestContext against registered routes.
   *
   * @param {import('../core/Context').RequestContext} ctx
   * @returns {Function | null} Matched handler or null
   */
  match(ctx) {
    const method = ctx.method;
    const pathname = ctx.pathname;

    for (const route of this.routes) {
      if (route.method !== '*' && route.method !== method) {
        continue;
      }

      if (route.isWildcard) {
        if (pathname.startsWith(route.basePath)) {
          return route.handler;
        }
      } else if (route.pattern === pathname) {
        return route.handler;
      }
    }

    return null;
  }

  /**
   * Dispatches the matched route handler for the context.
   *
   * @param {import('../core/Context').RequestContext} ctx
   * @returns {Promise<boolean>} True if route matched and was handled
   */
  async handle(ctx) {
    const handler = this.match(ctx);
    if (handler) {
      await handler(ctx);
      return true;
    }
    return false;
  }
}

module.exports = {
  Router,
};
