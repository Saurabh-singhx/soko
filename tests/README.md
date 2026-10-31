# Soko Test Suites

This directory contains integration, security, and component contract test suites for the Soko ecosystem (Desktop Dynamic Island HUD, Companion Mobile App, and Soko Universal Bridge).

The test harness runs against an isolated port (`PORT 8799` by default) and auto-spawns dedicated test bridge instances when necessary, ensuring zero interference with active development environments or running desktop apps on port `8766`.

## Test Suites

| File | Scope | Command |
|---|---|---|
| [`test_character_system.js`](file:///home/saurabh/coding/soko/tests/test_character_system.js) | Modular character system: essential states validation guardrails, activation verification, dynamic SVG mounting, and atmospheric state backgrounds. | `npm run test:characters` |
| [`test_security.js`](file:///home/saurabh/coding/soko/tests/test_security.js) | Zero-trust authentication, SAS PIN pairing exchange, bearer token authorization, TLS socket multiplexing, rate limiting, and 30-day token rotation. | `npm run test:security` |
| [`test_discovery.js`](file:///home/saurabh/coding/soko/tests/test_discovery.js) | Zero-configuration mDNS / DNS-SD responder wire encoding, HTTP /api/discovery endpoint, QR SVG image generation, URI parser edge cases, and automated pairing handshake loop. | `npm run test:discovery` |
| [`test_device_scanning_edge_cases.js`](file:///home/saurabh/coding/soko/tests/test_device_scanning_edge_cases.js) | Bluetooth & LAN discovery guardrails: one-time auto scan, manual re-scan triggers, connection state preservation, and concurrency debouncing. | `npm run test:scanning` |
| [`test_workspace_resolution.js`](file:///home/saurabh/coding/soko/tests/test_workspace_resolution.js) | Active workspace & working folder resolution: SQLite trajectory inspection (`~/.gemini/antigravity*`), tool path extraction, and Dynamic Island badge fallbacks. | `npm run test:workspace` |
| [`test_idle_and_agent_completion.js`](file:///home/saurabh/coding/soko/tests/test_idle_and_agent_completion.js) | Dynamic Island idle orb transitions, agent completion status badges, token formatting (`14.5k tokens`), layout clipping defense, and notification sizing. | `npm run test:island` |
| [`test_integration.js`](file:///home/saurabh/coding/soko/tests/test_integration.js) | End-to-end integration: HTTP discovery, notification mirroring, high-speed file transfers, SHA-256 upload verification, WebSocket framing, PipeWire desktop audio stream, and multi-session CLI telemetry. | `npm test` |

## Running Tests

Run the full end-to-end test suite (all 7 test suites):
```bash
npm run test:all
```

Run specific test suites:
```bash
# Character System & Atmospheric Backgrounds
npm run test:characters

# Zero-Trust Security & Sandbox Isolation
npm run test:security

# Zero-Configuration mDNS Discovery & QR Code Pairing
npm run test:discovery

# Device Scanning Guardrails & Concurrency Debouncing
npm run test:scanning

# CLI Agent Workspace & Working Folder Resolution
npm run test:workspace

# Dynamic Island Idle Transitions & Token Badges
npm run test:island

# Full Integration & API Suite
npm test
```
