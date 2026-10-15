# Soko Test Suites

This directory contains integration, security, and component contract test suites for the Soko ecosystem (Desktop Dynamic Island HUD, Companion Mobile App, and Soko Bridge).

## Test Suites

| File | Scope | Command |
|---|---|---|
| [`test_integration.js`](file:///home/saurabh/coding/soko/tests/test_integration.js) | Full integration test suite: HTTP API discovery, notification mirroring, file transfer streaming, checksums, WebSocket framing, desktop audio stream, and multi-session CLI telemetry. | `npm test` |
| [`test_security.js`](file:///home/saurabh/coding/soko/tests/test_security.js) | Zero-trust authentication, SAS PIN pairing exchange, bearer token authorization, sandbox path traversal defenses, and device forgetting/revocation. | `npm run test:security` |
| [`test_idle_and_agent_completion.js`](file:///home/saurabh/coding/soko/tests/test_idle_and_agent_completion.js) | Dynamic Island idle orb transitions, agent completion status badges, token highlights, layout clipping defense, and notification sizing. | `npm run test:island` |

## Running Tests

Run the primary integration suite:
```bash
npm test
```

Run security & zero-trust verification:
```bash
npm run test:security
```

Run Dynamic Island interaction & layout tests:
```bash
npm run test:island
```

Run all security and integration tests:
```bash
npm run test:all
```
