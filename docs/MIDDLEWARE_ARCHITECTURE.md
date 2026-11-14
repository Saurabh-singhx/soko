# Soko Monorepo: Production-Grade Middleware Architecture Specification & Design Guidelines

**Document Version**: 1.0.0  
**Author**: Soko Core Systems Architecture Team (Worker 1 / Milestone 1)  
**Status**: APPROVED & IMPLEMENTED  
**Target Systems**: `scripts/soko_bridge.js`, `packages/security`, Desktop Island, Mobile Companion  

---

## 1. Executive Summary & Problem Formulation

### 1.1 The Legacy Monolithic Handler
The Soko daemon (`scripts/soko_bridge.js`) hosts both HTTP/HTTPS REST APIs and WebSocket duplex streams on port `8766`. In the legacy implementation, all incoming HTTP requests were routed through a single 1,635-line procedural function (`const serverHandler = (req, res) => { ... }`).

Inside this monolith:
1. **Scattered Authentication Checks**: The manual snippet:
   ```javascript
   if (!isRequestAuthorized(req)) {
     rejectUnauthorized(res, req);
     return;
   }
   ```
   was manually copy-pasted across 19+ distinct endpoint blocks (e.g., `/api/tokens`, `/api/agent-activity`, `/api/cli`, `/api/notify`, `/api/transfer`, `/api/upload`, `/api/audio/*`).
2. **Security Omission Hazards**: When new endpoints were introduced, forgetting to copy the check (as occurred in `/api/agent-activity/simulate`) inadvertently exposed privileged endpoints to unauthenticated remote access.
3. **Inconsistent Diagnostics**: Several endpoints invoked `rejectUnauthorized(res)` without passing `req`, losing the `req._tokenExpired` diagnostic and preventing proper error messaging for 30-day token expirations.
4. **Duplicated Body Parsing**: Streaming buffer accumulation (`req.on('data', ...)`) was repeated across 14 separate handlers without centralized size caps or error handling for malformed JSON.
5. **Lack of Request Context**: Handlers had access only to raw Node.js `req` and `res` objects, lacking structured metadata such as correlation IDs, monotonic timing, authenticated device records, or client role.

### 1.2 The Production-Grade Solution
The production-grade middleware architecture resolves these challenges by introducing a modular, composable, asynchronous Onion / Chain-of-Responsibility pipeline under `scripts/middleware/`. Every incoming HTTP request flows sequentially through standardized middleware stages, guaranteeing that:
- **No protected endpoint can execute without centralized authentication and authorization.**
- **Host and Origin headers are strictly validated against DNS rebinding and CSRF before reaching any business logic.**
- **Rate limiting and abuse prevention are enforced prior to resource-intensive cryptographic checks.**
- **All errors adhere to a standardized, machine-readable JSON taxonomy strictly compatible with Desktop Island and Mobile Companion expectations.**
- **Unhandled exceptions are intercepted by a robust error boundary that guarantees sanitized HTTP 500 JSON responses without crashing the server daemon.**

---

## 2. Modular Folder Structure & Package Topology

The middleware subsystem resides in `scripts/middleware/`, ensuring direct CommonJS compatibility with `scripts/soko_bridge.js` without requiring transpilation or monorepo workspace re-linking:

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

## 3. Module Responsibilities & Interface Contracts

### 3.1 Pipeline Engine (`core/Pipeline.js`)
The `Pipeline` class implements the asynchronous Onion / Chain-of-Responsibility pattern:
```typescript
type NextFunction = () => Promise<void>;
type MiddlewareStage = (ctx: RequestContext, next: NextFunction) => Promise<void>;

interface Pipeline {
  use(stage: MiddlewareStage | MiddlewareStage[]): this;
  execute(ctx: RequestContext, finalHandler?: (ctx: RequestContext) => Promise<void> | void): Promise<void>;
}
```

**Key Behaviors**:
- **Onion Execution**: Stages run sequentially before `await next()` and in reverse order after `await next()`.
- **Short-Circuiting**: If a stage does not call `next()` (e.g. `corsStage` handling `OPTIONS` preflight with 204), downstream stages and the final route handler are not invoked.
- **Double-Invocation Protection**: If a stage calls `next()` more than once, an error is thrown, caught by the error boundary, and transformed into a 500 Internal Server Error.
- **Error Boundary**: Wraps execution in `try...catch`. Any thrown `HttpError` is formatted into its exact HTTP status code and JSON payload. Uncaught generic errors are sanitized into 500 JSON with correlation `reqId` tracking.

### 3.2 Strongly-Typed `RequestContext` (`core/Context.js`)
The `RequestContext` object encapsulates request state and lifecycle methods across all middleware stages:

```typescript
interface RequestContext {
  // Traceability & High-Resolution Timing
  readonly reqId: string;           // 'req_' + 16-hex CSPRNG correlation ID
  readonly startTime: bigint;       // process.hrtime.bigint()
  readonly clientIp: string;        // Normalized IPv4 (e.g. '192.168.1.100' or '127.0.0.1')
  readonly isLoopback: boolean;     // True for local loopback (127.0.0.1, ::1) without simulation
  readonly isSimulatedRemote: boolean; // True if x-simulate-remote-ip was provided

  // Native Node.js HTTP Handles
  readonly req: import('http').IncomingMessage;
  readonly res: import('http').ServerResponse;

  // Parsed Request Data
  readonly method: string;          // 'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'
  readonly url: URL;                // Full WHATWG URL object
  readonly pathname: string;        // Parsed path (e.g. '/api/tokens')
  readonly query: URLSearchParams;  // Parsed query parameters
  readonly headers: Record<string, string | string[] | undefined>;
  body: any;                        // Populated by bodyParserStage (parsed JSON object or null)

  // Security Identity & Session State
  auth: {
    authenticated: boolean;         // True if loopback or valid bearer token
    authType: 'loopback' | 'bearer' | 'none';
    token: string | null;           // 128-bit hex Bearer token
    tokenExpired: boolean;          // True if token is older than 30 days
    deviceId: string | null;        // Paired device UUID
    role: 'admin' | 'paired_device' | 'anonymous';
    permissions: Set<string>;       // Granted scopes (e.g. 'companion:read', 'cli:execute')
  };

  // Associated Device Record from TrustStore
  device: TrustedDeviceRecord | null;

  // Rate Limiting State
  rateLimit: {
    checked: boolean;
    allowed: boolean;
    attempts: number;
    retryAfter: number;             // Cooldown in seconds
  };

  // Response Helpers
  sendJson(statusCode: number, data: any, extraHeaders?: Record<string, string>): void;
  sendError(statusCode: number, message?: string, code?: string, extra?: Record<string, any>): void;
  recordFailure(): void;
  recordSuccess(): void;
}
```

### 3.3 Unified HTTP Error Hierarchy (`core/errors.js`)
All errors inherit from `HttpError`, providing machine-readable error codes and status codes:
- `BadRequestError` (400): DNS rebinding violations, malformed JSON, invalid parameters.
- `UnauthorizedError` (401): Missing Bearer token, invalid token, or expired token (>30 days).
- `ForbiddenError` (403): Untrusted CORS origin, remote access to local-only endpoints, non-whitelisted CLI command.
- `TooManyRequestsError` (429): SAS PIN brute-force cooldown active, attaches `Retry-After`.
- `InternalServerError` (500): Uncaught exceptions with correlation `reqId`.

---

## 4. Sequential Request Processing Pipeline Execution Order

The HTTP request processing pipeline executes in 8 discrete phases:

```
Incoming Request (req, res)
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ 1. Audit Logging Stage (Outer Shell)                   │
│    - Captures high-resolution monotonic start time     │
│    - Measures total execution duration in ms           │
│    - Logs structured INFO / WARN / ERROR via Logger    │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Transport & CORS Hardener Stage                     │
│    - Validates Host against DNS rebinding (400 on fail)│
│    - Intercepts OPTIONS preflight immediately (204)    │
│    - Validates Origin against trusted schemes & local  │
│    - Emits explicit CORS headers; never wildcard '*'   │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Rate Limiting Stage                                 │
│    - Targets pairing routes (/api/pair)                │
│    - Queries RateLimiter.checkLimit(ctx.clientIp)      │
│    - Throws 429 Too Many Requests during active delays │
│    - Injects standard Retry-After header               │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 4. Body Parser Stage                                   │
│    - Bypasses binary streaming routes (/api/upload)    │
│    - Enforces 512KB payload ceiling                    │
│    - Buffers & parses JSON; throws 400 on malformed    │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 5. Authentication Stage                                │
│    - Detects loopback (127.0.0.1 / ::1) without bypass │
│    - Extracts Bearer / Token header or ?token= query   │
│    - Validates against TokenManager & checks 30-day TTL│
│    - Populates ctx.auth (authenticated, role, scopes)  │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 6. Identity & TrustStore Stage                         │
│    - For bearer callers: queries TrustStore for device │
│    - Binds live device entity to ctx.device            │
│    - Revokes authentication if device was forgotten    │
└──────────────────────────┬─────────────────────────────┘
                           │ next()
                           ▼
┌────────────────────────────────────────────────────────┐
│ 7. Role-Based Access Control (RBAC) Stage              │
│    - Classifies route: PUBLIC / LOCAL_ONLY / PROTECTED │
│    - PUBLIC: Allows unauthenticated access             │
│    - LOCAL_ONLY: Enforces ctx.isLoopback === true      │
│    - PROTECTED: Enforces ctx.auth.authenticated === true│
│    - Checks required scopes (companion:read, write)   │
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

## 5. Centralized Authentication & Authorization Routing

### 5.1 Credential Extraction Hierarchy
The `authStage` checks three distinct credential locations in priority order:
1. `Authorization: Bearer <128-bit-hex-token>`
2. `Authorization: Token <128-bit-hex-token>`
3. URL Query Parameter: `?token=<128-bit-hex-token>`

### 5.2 30-Day TTL Check & Expiration Flag
When a token is validated via `tokenManager.validateToken(token)`:
- If `Date.now() > device.expiresAt`:
  `ctx.auth.tokenExpired = true` and `ctx.auth.authenticated = false`.
- When downstream `rbacStage` rejects the request on a `PROTECTED` route, it emits:
  ```json
  {
    "error": "Unauthorized: Bearer token has expired after 30 days. Complete PIN pairing on Desktop Island first.",
    "code": 401,
    "tokenExpired": true,
    "requiresPairing": true
  }
  ```
  This signals the Mobile Companion to initiate re-pairing or token rotation via `/api/auth/refresh`.

### 5.3 Local Loopback Trust & Test Simulation Support
- **Loopback Trust**: Requests originating from `127.0.0.1`, `::1`, or `::ffff:127.0.0.1` are automatically granted `authType: 'loopback'`, `role: 'admin'`, and full wildcard permissions `['*']`. This ensures local desktop Dynamic Island components operate without token management overhead.
- **Simulation Bypass (`x-simulate-remote-ip`)**: When an HTTP request includes the `x-simulate-remote-ip: <IP>` header (e.g. during zero-trust integration tests in `tests/test_security.js`), `ctx.isLoopback` is forced to `false` and `ctx.clientIp` is set to the simulated remote IP. This guarantees complete testability of remote Zero-Trust rules on local test runners.

### 5.4 Identity Store Verification (`TrustStore`)
`TrustStore` persists paired credentials in the OS standard configuration directory:
- Linux: `$XDG_CONFIG_HOME/soko/trust_store.json` (or `~/.config/soko/`)
- Windows: `%APPDATA%\soko\trust_store.json`
- macOS: `~/Library/Application Support/soko/trust_store.json`

File writes are atomic via temporary swap files (`.tmp.<timestamp>.<rand>`) with strict POSIX `0600` file permissions. During Stage 6 (`identityStage`), the pipeline queries `trustStore.get(ctx.auth.deviceId)`. If a desktop user has deleted or forgotten the device, `ctx.auth.authenticated` is immediately revoked, preventing revoked credentials from accessing protected APIs.

### 5.5 Declarative Route Security Policy Table
Endpoints are classified according to strict security tiers:

| Route | Methods | Policy | Required Permissions / Rules | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/api/discovery`, `/api/discovery/qr` | `GET` | `PUBLIC` | None | mDNS & QR discovery metadata |
| `/api/status` | `GET` | `PUBLIC` | None | Bridge status & pairing health probe |
| `/api/devices/scan`, `/api/devices/discovered` | `GET` | `PUBLIC` | None | Bluetooth BLE & Wi-Fi device scan |
| `/api/pair` | `POST` | `PUBLIC` | Rate-Limited (`RateLimiter`) | SAS PIN verification & pairing initiation |
| `/api/pair/status` | `GET` | `PUBLIC` | None | Pairing approval polling |
| `/api/auth/refresh`, `/api/pair/refresh` | `POST` | `PUBLIC` | Requires valid refreshToken | 30-day token rotation |
| `/`, `/mobile`, `/companion`, `/*` | `GET`, `HEAD` | `PUBLIC` | None | PWA static assets & web companion |
| `/api/devices/pending-pin` | `GET`, `POST` | `LOCAL_ONLY` | Loopback only | Desktop Island SAS PIN display & regen |
| `/api/devices/pending-pair` | `GET` | `LOCAL_ONLY` | Loopback only | Desktop pending pair request queue |
| `/api/devices/pair-select` | `POST` | `LOCAL_ONLY` | Loopback only | Desktop user pairing approval |
| `/api/devices/unpair`, `/api/unpair` | `POST` | `LOCAL_ONLY` | Loopback only | Desktop user device forgetting |
| `/api/tokens` | `GET` | `PROTECTED` | `companion:read` | Real-time AI token telemetry |
| `/api/agent-activity`, `/api/agent-sessions` | `GET` | `PROTECTED` | `companion:read` | Active CLI agent telemetry |
| `/api/agent-activity/simulate` | `POST` | `PROTECTED` | `companion:write` | Agent simulation control |
| `/api/notify` | `POST` | `PROTECTED` | `companion:write` | Mobile notification mirroring |
| `/api/cli` | `POST` | `PROTECTED` | `cli:execute` + Whitelist | Whitelisted CLI execution (`sysinfo`, etc.) |
| `/api/agent/sessions`, `/api/agent/transcript` | `GET`, `POST` | `PROTECTED` | `companion:read` | Remote agent sessions & terminal |
| `/api/agent/prompt` | `POST` | `PROTECTED` | `companion:write` | Dispatch prompt to remote agent |
| `/api/transfer`, `/api/transfer/cancel`, `/retry` | `POST` | `PROTECTED` | `companion:write` | High-speed file transfer control |
| `/api/upload` | `POST`, `PUT` | `PROTECTED` | `companion:write` (Streaming) | Binary file upload to transfers sandbox |
| `/api/transfers`, `/api/transfers/open` | `GET`, `POST` | `PROTECTED` | `companion:read`, `write` | File download & local desktop open |
| `/transfers/*` | `GET`, `HEAD` | `PROTECTED` | (except `/transfers/music/*`) | Download transfer files |
| `/transfers/music/*` | `GET`, `HEAD` | `PUBLIC` | Public audio cache | Stream cached music tracks |
| `/api/audio/status` | `GET` | `PUBLIC` | None | Audio playback state probe |
| `/api/audio/stream` | `GET`, `HEAD` | `PROTECTED` | `companion:read` | Live PipeWire MP3 audio stream |
| `/api/audio/control`, `/api/audio/mute-speaker` | `POST` | `PROTECTED` | `companion:write` | Play/pause & volume controls |
| `/api/audio/settings` | `POST` | `PROTECTED` | `companion:write` | Audio engine configuration |
| `/api/auth/revoke-all`, `/api/devices/revoke-all`| `POST` | `PROTECTED` | `companion:admin` | Revoke all paired credentials |

---

## 6. Standardized Error Handling Taxonomy

The middleware pipeline enforces a consistent HTTP response schema strictly matching existing client expectations:

```
┌────────────────────────────────────────────────────────────────────────┐
│ HTTP 400 Bad Request                                                   │
├────────────────────────────────────────────────────────────────────────┤
│ {                                                                      │
│   "error": "Bad Request: Invalid Host header (DNS Rebinding...)",      │
│   "code": 400,                                                         │
│   "host": "evil-attacker.com"                                          │
│ }                                                                      │
│ or for invalid JSON:                                                   │
│ {                                                                      │
│   "error": "Bad Request: Invalid JSON payload",                        │
│   "code": 400                                                          │
│ }                                                                      │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ HTTP 401 Unauthorized (Missing / Invalid Token)                        │
├────────────────────────────────────────────────────────────────────────┤
│ {                                                                      │
│   "error": "Unauthorized: Remote device is not paired or missing...",  │
│   "code": 401,                                                         │
│   "tokenExpired": false,                                               │
│   "requiresPairing": true                                              │
│ }                                                                      │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ HTTP 401 Unauthorized (Expired Token > 30 Days)                        │
├────────────────────────────────────────────────────────────────────────┤
│ {                                                                      │
│   "error": "Unauthorized: Bearer token has expired after 30 days...",  │
│   "code": 401,                                                         │
│   "tokenExpired": true,                                                │
│   "requiresPairing": true                                              │
│ }                                                                      │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ HTTP 403 Forbidden                                                     │
├────────────────────────────────────────────────────────────────────────┤
│ {                                                                      │
│   "error": "Forbidden: Untrusted Cross-Origin Request Blocked...",     │
│   "code": 403,                                                         │
│   "origin": "https://malicious-site.org"                               │
│ }                                                                      │
│ or for non-whitelisted CLI command:                                    │
│ {                                                                      │
│   "error": "Security violation: Command 'xyz' not permitted in...",   │
│   "code": 403,                                                         │
│   "exitCode": 403                                                      │
│ }                                                                      │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ HTTP 429 Too Many Requests                                             │
├────────────────────────────────────────────────────────────────────────┤
│ Header: Retry-After: 15                                                │
│ {                                                                      │
│   "status": "rejected",                                                │
│   "error": "RATE_LIMITED",                                             │
│   "retryAfter": 15,                                                    │
│   "message": "Too Many Requests: Rate limit active. Retry after 15s."  │
│ }                                                                      │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ HTTP 500 Internal Server Error (Sanitized Error Boundary)              │
├────────────────────────────────────────────────────────────────────────┤
│ {                                                                      │
│   "error": "Internal Server Error",                                    │
│   "code": 500,                                                         │
│   "reqId": "req_5f2c8a1e0b9432f1"                                      │
│ }                                                                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Migration Steps for `scripts/soko_bridge.js`

To migrate `scripts/soko_bridge.js` from the monolithic `serverHandler` to the production middleware pipeline with zero downtime and zero regressions, follow these concrete steps:

### Step 1: Import Middleware Facade in `scripts/soko_bridge.js`
At the top of `scripts/soko_bridge.js` (around line 40):
```javascript
const {
  createBridgeMiddlewareAdapter,
  Router,
} = require('./middleware');
```

### Step 2: Initialize Bridge Middleware Adapter
After instantiating `corsHardener`, `rateLimiter`, `tokenManager`, and `trustStore` (around line 6730):
```javascript
const bridgeMiddlewareAdapter = createBridgeMiddlewareAdapter({
  corsHardener,
  rateLimiter,
  tokenManager,
  trustStore,
  logger: rollingLogger,
});
```

### Step 3: Replace Monolithic `serverHandler` Entry Point
Replace lines 5096–5136:
```javascript
// BEFORE (Legacy Monolithic Entry):
const serverHandler = (req, res) => {
  const isAuthorized = isRequestAuthorized(req);
  if (!corsHardener.validateRequest(req, res, { hasValidBearerToken: isAuthorized })) return;
  if (corsHardener.handlePreflight(req, res, { hasValidBearerToken: isAuthorized })) return;
  // ... manual CORS monkey patching ...
  // ... 38 procedural if (url.pathname === ...) blocks ...
};

// AFTER (Production Middleware Pipeline):
const serverHandler = (req, res) => {
  bridgeMiddlewareAdapter.handleRequest(req, res, async (ctx) => {
    // When the request reaches this callback, it has passed:
    // 1. Audit Logging
    // 2. DNS Rebinding & Host validation
    // 3. CORS Preflight & Origin validation
    // 4. Rate Limiting cooldown checks
    // 5. Safe JSON body parsing (ctx.body is pre-parsed)
    // 6. Bearer token / local loopback authentication
    // 7. TrustStore identity validation
    // 8. RBAC endpoint access authorization
    
    // Execute endpoint route handlers using clean ctx:
    await legacyRouteDispatcher(ctx);
  });
};
```

### Step 4: Eliminate Redundant Boilerplate in Route Handlers
With the middleware pipeline active, route handlers no longer require manual checks:
- **Delete duplicated `if (!isRequestAuthorized(req)) { rejectUnauthorized(res); return; }`** from all 19 endpoints! The RBAC stage has already guaranteed authorization.
- **Delete duplicated body parsing loops** (`let body = ''; req.on('data', ...)`). Simply access `ctx.body` directly!
- **Use `ctx.sendJson(statusCode, data)`** instead of manual `res.writeHead(...)` and `res.end(JSON.stringify(data))`.

---

## 8. Automated Test & Verification Strategy

The middleware architecture is validated by a rigorous two-tier verification suite conforming to Requirement R3:

### 8.1 Tier 1: In-Memory Unit Test Suite (`scripts/middleware/tests/`)
- **Location**: `scripts/middleware/tests/middleware_unit.test.js`
- **Framework**: Built-in Node.js Test Runner (`node:test`) and Assertions (`node:assert`). Zero external dependencies.
- **Execution**: Runs in <25 milliseconds without opening network sockets using in-memory mock `req` and `res` objects.
- **Coverage**:
  - `Pipeline.js`: Execution order, `next()` chaining, double-invocation prevention, error boundary interception.
  - `Context.js`: `reqId` generation, high-resolution monotonic timing, IPv4/IPv6 normalization, loopback detection, `x-simulate-remote-ip` test override, wildcard `*` CORS elimination.
  - Individual Stages: `corsStage` (DNS rebinding, preflight), `rateLimitStage` (progressive delays, 429), `bodyParserStage` (JSON parsing, 512KB cap, upload streaming), `authStage` (Bearer, Token, query token, loopback, 30-day expiration), `identityStage` (TrustStore revocation), `rbacStage` (PUBLIC, LOCAL_ONLY, PROTECTED, CLI command whitelist), `auditLogStage` (structured timing metrics).
- **Run Command**:
  ```bash
  node scripts/middleware/tests/middleware_unit.test.js
  ```

### 8.2 Tier 2: Real HTTP Integration Test Suite (`tests/test_middleware_pipeline.js`)
- **Location**: `tests/test_middleware_pipeline.js`
- **Port Isolation**: Binds to isolated port `8794` (`PORT=8794`), eliminating port contention with existing test suites (8766, 8796, 8798).
- **Execution**: Mounts the full pipeline on a live HTTP server, creates real instances of `TrustStore`, `TokenManager`, `RateLimiter`, and `CorsHardener` in isolated temporary directories, and executes real HTTP network requests.
- **Verification Matrix**:
  1. Foreign Host header blocked with 400 (DNS rebinding).
  2. OPTIONS preflight returns 204 No Content with strict origin.
  3. Untrusted browser Origin blocked with 403 Forbidden.
  4. Public endpoint accessible without credentials (200 OK).
  5. Protected endpoint blocked with 401 when credentials missing (`requiresPairing: true`).
  6. Protected endpoint blocked with 401 when token is invalid.
  7. Protected endpoint blocked with 401 and `tokenExpired: true` when token is older than 30 days.
  8. Local loopback automatically trusted without Bearer token.
  9. Authorized remote request succeeds with valid Bearer token.
  10. Alternate token presentations (`Token <token>` and `?token=`) succeed.
  11. Remote caller accessing LOCAL_ONLY endpoint rejected with 403 Forbidden.
  12. Loopback caller permitted on LOCAL_ONLY endpoint.
  13. Whitelisted CLI command (`sysinfo`) accepted with 200 OK.
  14. Non-whitelisted CLI command blocked with 403 Forbidden.
  15. Progressive rate limiting triggers 429 Too Many Requests with standard `Retry-After` header.
  16. Safe body parser parses valid JSON and rejects malformed JSON with 400.
  17. Binary streaming upload on `/api/upload` bypasses JSON buffering cleanly.
  18. Uncaught route exception caught by error boundary, producing sanitized 500 JSON without crashing server.
  19. Revoking device from `TrustStore` immediately rejects subsequent requests with 401.
- **Run Command**:
  ```bash
  node tests/test_middleware_pipeline.js
  ```

### 8.3 Zero-Regression Monorepo Integration (`package.json`)
The middleware test suites are integrated into root `package.json`:
- `"test:middleware"` runs both unit and integration suites.
- `"test"` and `"test:all"` include `"test:middleware"` without regressions.
- CI Workflow (`.github/workflows/ci.yml`) automatically executes all middleware verification gates on every push.
