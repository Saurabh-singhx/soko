# Soko Production-Grade Middleware Architecture

`scripts/middleware` provides an enterprise-grade, asynchronous Onion / Chain-of-Responsibility request processing pipeline for the Soko bridge server daemon (`scripts/soko_bridge.js`).

It centralizes transport hardening, DNS rebinding protection, strict CORS header synthesis, progressive rate limiting, safe JSON body parsing, Bearer token authentication, TrustStore identity verification, RBAC endpoint policy enforcement, and standardized error responses.

---

## Folder Layout

```
scripts/middleware/
├── README.md                    # Developer summary & architecture overview
├── index.js                     # Public API facade & bridge integration factory
├── core/
│   ├── Pipeline.js              # Asynchronous onion pipeline engine with error boundary
│   ├── Context.js               # RequestContext abstraction & JSON/error response helpers
│   └── errors.js                # Unified HTTP error hierarchy (400, 401, 403, 429, 500)
├── stages/
│   ├── corsStage.js             # Stage 1: DNS rebinding defense, strict CORS & OPTIONS preflight
│   ├── rateLimitStage.js        # Stage 2: Progressive SAS PIN brute-force defense & cooldown
│   ├── bodyParserStage.js       # Stage 3: Safe streaming JSON body parser (512KB cap)
│   ├── authStage.js             # Stage 4: Bearer / Token / loopback authentication & 30-day TTL check
│   ├── identityStage.js         # Stage 5: TrustStore device record verification
│   ├── rbacStage.js             # Stage 6: Endpoint policy enforcement & CLI whitelist
│   └── auditLogStage.js         # Outer wrapper: High-resolution timing & structured security logging
├── routing/
│   ├── routes.js                # Route security classification table (PUBLIC, LOCAL_ONLY, PROTECTED)
│   └── router.js                # Declarative HTTP method and pathname matcher
└── tests/
    ├── test_helpers.js          # In-memory mock req/res and security services factory
    ├── pipeline.test.js         # Unit tests: pipeline chaining, context derivation, error boundary
    ├── stages.test.js           # Unit tests: individual stages (CORS, RateLimit, Auth, RBAC, etc.)
    └── middleware_unit.test.js  # Master unit test runner (node:test + node:assert)
```

---

## Sequential Execution Pipeline

Every incoming HTTP request flows sequentially through the following middleware stages:

```
Incoming Request (req, res)
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ 1. Audit Logging Stage (Outer Shell)                   │
│    - Captures high-resolution monotonic start time     │
│    - Catches unhandled errors & logs structured events │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Transport & CORS Hardener Stage                     │
│    - Validates Host against DNS rebinding (400 on fail)│
│    - Handles OPTIONS preflight immediately (204)       │
│    - Enforces Origin whitelist & sets strict headers   │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Rate Limiting Stage                                 │
│    - Progressive backoff cooldown for pairing routes   │
│    - Returns 429 Too Many Requests with Retry-After    │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 4. Body Parser Stage                                   │
│    - Buffers & parses JSON payloads (512KB limit)      │
│    - Bypasses binary streaming routes (/api/upload)    │
│    - Returns 400 Bad Request on invalid JSON           │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 5. Authentication Stage                                │
│    - Checks local loopback trust (127.0.0.1, ::1)      │
│    - Extracts Bearer header, Token header, or ?token=  │
│    - Validates against TokenManager & checks 30-day TTL│
│    - Populates ctx.auth (authenticated, role, etc.)    │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 6. Identity & TrustStore Stage                         │
│    - Queries TrustStore for authenticated devices      │
│    - Binds live device entity to ctx.device            │
│    - Detects forgotten/revoked devices immediately     │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 7. Role-Based Access Control (RBAC) Stage              │
│    - Enforces endpoint security tier:                  │
│        * PUBLIC: Allowed without credentials           │
│        * LOCAL_ONLY: Strictly local desktop loopback   │
│        * PROTECTED: Requires valid authentication      │
│    - Enforces CLI command whitelist on /api/cli        │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 8. Route Handler                                       │
│    - Executes endpoint business logic with clean ctx   │
│    - Emits response via ctx.sendJson()                 │
└────────────────────────────────────────────────────────┘
```

---

## Quick Start Example

```javascript
const http = require('http');
const { createBridgeMiddlewareAdapter, Router } = require('./scripts/middleware');
const { TrustStore, TokenManager, RateLimiter, CorsHardener } = require('./packages/security');

const trustStore = new TrustStore();
const tokenManager = new TokenManager(trustStore);
const rateLimiter = new RateLimiter();
const corsHardener = new CorsHardener({ port: 8766 });

const adapter = createBridgeMiddlewareAdapter({
  corsHardener,
  rateLimiter,
  tokenManager,
  trustStore,
});

const router = new Router();
router.get('/api/tokens', (ctx) => {
  ctx.sendJson(200, { totalTokens: 42000 });
});

const server = http.createServer((req, res) => {
  adapter.handleRequest(req, res, (ctx) => router.handle(ctx));
});

server.listen(8766);
```

---

## Verification

Run the comprehensive unit test suite:
```bash
node scripts/middleware/tests/middleware_unit.test.js
```

Run the socket integration test suite on port 8794:
```bash
node tests/test_middleware_pipeline.js
```
