/**
 * Soko Production-Grade Middleware Architecture Facade
 *
 * Centralizes request processing pipeline stages, authentication, authorization,
 * error handling, and bridge integration helpers for Soko Bridge.
 */

const { Pipeline, createPipeline } = require('./core/Pipeline');
const { RequestContext, createRequestContext, normalizeIp } = require('./core/Context');
const {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  TooManyRequestsError,
  InternalServerError,
} = require('./core/errors');

const { createCorsStage } = require('./stages/corsStage');
const { createRateLimitStage } = require('./stages/rateLimitStage');
const { createBodyParserStage } = require('./stages/bodyParserStage');
const { createAuthStage, extractToken } = require('./stages/authStage');
const { createIdentityStage } = require('./stages/identityStage');
const { createRbacStage, DEFAULT_CLI_WHITELIST } = require('./stages/rbacStage');
const { createAuditLogStage } = require('./stages/auditLogStage');

const { Router } = require('./routing/router');
const { ROUTE_POLICY, DEFAULT_ROUTES, classifyRoute } = require('./routing/routes');

/**
 * Creates a fully configured production HTTP pipeline with standard stages in sequential order:
 * 1. Audit Logging & Security Telemetry (Outer Shell)
 * 2. Host Hardening & Strict CORS (DNS Rebinding Defense, Preflight)
 * 3. Rate Limiting & Abuse Defense (Progressive PIN Cooldown)
 * 4. Safe JSON Body Parsing (512KB limit, upload streaming bypass)
 * 5. Authentication (Bearer token, 30-day TTL check, local loopback)
 * 6. Identity & TrustStore Verification
 * 7. Role & Permission Authorization (RBAC Guard, CLI whitelist)
 *
 * @param {object} [services]
 * @param {import('../packages/security').CorsHardener} [services.corsHardener]
 * @param {import('../packages/security').RateLimiter} [services.rateLimiter]
 * @param {import('../packages/security').TokenManager} [services.tokenManager]
 * @param {import('../packages/security').TrustStore} [services.trustStore]
 * @param {import('../packages/logger').RollingFileLogger} [services.logger]
 * @param {Array<object>} [services.routes]
 * @param {Set<string>} [services.cliWhitelist]
 * @param {object} [options]
 * @returns {Pipeline}
 */
function createHttpPipeline(services = {}, options = {}) {
  const pipeline = createPipeline(options);

  // Stage 1: Audit Logging & Monotonic Timing
  pipeline.use(createAuditLogStage({ logger: services.logger }));

  // Stage 2: Transport & Host Hardening (CORS & DNS Rebinding)
  if (services.corsHardener) {
    pipeline.use(createCorsStage({ corsHardener: services.corsHardener }));
  }

  // Stage 3: Rate Limiting & Cooldown Protection
  if (services.rateLimiter) {
    pipeline.use(createRateLimitStage({ rateLimiter: services.rateLimiter }));
  }

  // Stage 4: Safe Body Parsing
  pipeline.use(createBodyParserStage({ maxSizeBytes: options.maxBodySizeBytes }));

  // Stage 5: Authentication & Bearer Validation
  pipeline.use(createAuthStage({ tokenManager: services.tokenManager }));

  // Stage 6: Identity & Trust Store Verification
  if (services.trustStore) {
    pipeline.use(createIdentityStage({ trustStore: services.trustStore }));
  }

  // Stage 7: Role & Permission Authorization (RBAC)
  pipeline.use(
    createRbacStage({
      routes: services.routes,
      cliWhitelist: services.cliWhitelist || DEFAULT_CLI_WHITELIST,
    })
  );

  return pipeline;
}

/**
 * Bridge Integration Adapter
 * Creates a bridge-friendly adapter wrapping HTTP request processing into the pipeline.
 *
 * @param {object} services
 * @returns {{ pipeline: Pipeline, handleRequest: (req, res, finalHandler) => Promise<void> }}
 */
function createBridgeMiddlewareAdapter(services = {}) {
  const pipeline = createHttpPipeline(services);

  return {
    pipeline,
    async handleRequest(req, res, finalHandler) {
      const ctx = createRequestContext(req, res, {
        corsHardener: services.corsHardener,
        rateLimiter: services.rateLimiter,
      });
      await pipeline.execute(ctx, finalHandler);
    },
  };
}

module.exports = {
  // Core Pipeline & Context
  Pipeline,
  createPipeline,
  RequestContext,
  createRequestContext,
  normalizeIp,

  // Standard Errors
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  TooManyRequestsError,
  InternalServerError,

  // Stages
  createCorsStage,
  createRateLimitStage,
  createBodyParserStage,
  createAuthStage,
  extractToken,
  createIdentityStage,
  createRbacStage,
  createAuditLogStage,
  DEFAULT_CLI_WHITELIST,

  // Routing
  Router,
  ROUTE_POLICY,
  DEFAULT_ROUTES,
  classifyRoute,

  // Pipeline Factories
  createHttpPipeline,
  createBridgeMiddlewareAdapter,
};
