# Test Coverage Matrix — MixDeck DJ Player

## Summary

| Metric | Value |
|--------|-------|
| Total tests (all browsers) | 1,058 |
| Unique test cases | 319 |
| Test files | 6 |
| Browsers | Chromium, Firefox, WebKit, Mobile (iPhone 14) |
| API tests | Run once (no browser needed) |
| Smoke suite | 12 tests, ~3 seconds |

## Coverage by Feature

### UI / E2E (tests/dj-player.spec.ts — 172 tests)

| Feature | Tests | Coverage | Notes |
|---------|-------|----------|-------|
| Page load & initial state | 12 | Full | Title, defaults, all tracks render |
| Track selection | 9 | Full | Click to select, now-playing panel updates |
| Playback controls | 15 | Full | Play, pause, next, prev, track-ended auto-advance |
| Time display | 10 | Full | Current time, duration, formatting |
| Seeking | 7 | Full | Arrow keys, click, drag, edge cases |
| Mobile responsive | 1 | Partial | Volume hidden at 640px (more in mobile.spec.ts) |
| Search | 10 | Full | Title, artist, genre, key, case-insensitive, clear |
| Genre filters | 10 | Full | Filter, combine with search, "All" reset |
| Volume | 12 | Full | Slider, mute/unmute, keyboard, persistence |
| Accessibility | 18 | Full | ARIA labels, roles, axe-core WCAG 2.1 AA scan |
| Edge cases | 5 | Full | Keyboard in search, genre boundaries |
| Keyboard shortcuts | 12 | Full | Space, arrows, M key, shift+arrows |
| Visual feedback | 5 | Full | EQ bars appear/disappear/move |
| Visual regression | 6 | Full | Screenshots for 6 states (masked waveform) |
| Drag seeking | 3 | Full | Drag progress bar, fill updates, reset to 0 |
| Playback + filter interaction | 5 | Full | Playing while filtering, clearing filters |
| Track number display | 5 | Full | Numbers vs EQ bars, renumbering on filter |
| Search input isolation | 4 | Full | Keyboard shortcuts don't fire while typing |
| Play/pause resilience | 4 | Full | Rapid toggling, track switching |
| Performance (Core Web Vitals) | 9 | Full | TTFB, FCP, LCP, CLS, long tasks, page weight |

### Mobile (tests/mobile.spec.ts — 16 tests)

| Feature | Tests | Coverage | Notes |
|---------|-------|----------|-------|
| Layout breakpoint (640px) | 10 | Full | Hidden columns, smaller artwork, no overflow |
| Touch interactions | 4 | Full | Tap to select, tap to play, genre filter, navigation |
| Mobile accessibility | 2 | Full | Touch target sizes, text readability |

### API (tests/api.spec.ts — 68 tests)

| Feature | Tests | Coverage | Notes |
|---------|-------|----------|-------|
| GET /api/tracks | 4 | Full | Status, content-type, fields, order |
| GET /api/tracks (filtering) | 10 | Full | Genre, search, combined, empty results |
| GET /api/tracks/:id | 3 | Full | Valid, 404, invalid ID |
| POST /api/tracks | 7 | Full | Create, validate, auto-increment |
| PUT /api/tracks/:id | 8 | Full | Update fields, partial update, validation |
| DELETE /api/tracks/:id | 5 | Full | Delete, verify gone, 404 |
| POST /api/tracks/reset | 3 | Full | Reset state, ID counter |
| Static assets | 3 | Full | HTML served, 404 for unknown, concurrency |
| Edge cases | 4 | Full | Special chars, URL encoding, empty body |
| Full CRUD lifecycle | 1 | Full | Create → Read → Update → Delete → Verify |
| HEAD requests | 2 | Full | Headers without body |
| Contract testing (zod) | 13 | Full | Schema validation on all response shapes |
| ID reuse behavior | 1 | Full | Deleted IDs not reused |

### Security (tests/security.spec.ts — 39 tests)

| Category | Tests | Coverage | Notes |
|----------|-------|----------|-------|
| XSS (Cross-Site Scripting) | 5 | Full | Stored, reflected, search, genre, browser execution |
| Injection attacks | 3 | Full | SQL injection, NoSQL, UNION |
| Path traversal | 4 | Full | ../etc/passwd, server.js, package.json, encoded |
| Prototype pollution | 2 | Full | __proto__, constructor.prototype |
| Oversized/malformed payloads | 5 | Full | Long strings, null bytes, unicode, empty |
| Type coercion | 6 | Full | Array, number, boolean, object, wrong types |
| HTTP method abuse | 3 | Full | PATCH, PUT/DELETE on collection |
| ID manipulation | 5 | Full | Negative, decimal, huge, leading zeros, zero |
| Response security headers | 2 | Documented | X-Powered-By finding (bug report filed) |
| Rate limiting / abuse | 4 | Full | Rapid reads, concurrent writes, mixed, dedup |

### Network Interception (tests/network-interception.spec.ts — 10 tests)

| Feature | Tests | Coverage | Notes |
|---------|-------|----------|-------|
| Graceful degradation | 2 | Full | CSS blocked, JS blocked |
| Response modification | 2 | Full | Modify title, inject DOM element |
| Slow network | 1 | Full | 2s delay on main script |
| Request monitoring | 2 | Full | Asset requests logged, no external requests |
| Error handling | 2 | Full | 500 response, unreachable API |
| Content-type verification | 1 | Full | CSS and JS correct types |

### Sauce Demo (tests/sauce-demo.spec.ts — 14 tests)

| Feature | Tests | Coverage | Notes |
|---------|-------|----------|-------|
| Authentication | 3 | Full | Valid login, locked out, invalid |
| Product listing | 3 | Full | Count, details, sort |
| Cart operations | 3 | Full | Add, remove, badge count |
| Checkout flow | 3 | Full | Form, validation, complete order |
| Navigation | 2 | Full | Sidebar menu, product detail link |

### Load Testing (load-tests/ — k6)

| Test | VUs | Duration | Scenarios |
|------|-----|----------|-----------|
| api-load.js | 10→30 | 70s | GET all, GET by ID, search, genre, create, CRUD |
| api-stress.js | 10→200 | 80s | Reads (50%), lookups (20%), search (15%), writes (15%) |

## Coverage Gaps

| Area | Status | Rationale |
|------|--------|-----------|
| Unit tests | Not included | QA focus is on integration and E2E; unit tests are developer-owned |
| Authentication/authorization | N/A | App has no auth layer |
| Database testing | N/A | In-memory store, no persistence layer |
| Multi-user concurrency | Partial | k6 stress test covers this at the HTTP level |
| Internationalization (i18n) | Not tested | App is English-only |
| Offline/PWA behavior | Not tested | App has no service worker |
| File upload | N/A | No upload functionality |
| Email/notifications | N/A | No notification system |

## How to Run

```bash
# Full suite (all browsers)
npx playwright test

# Smoke tests only (~3 seconds)
npx playwright test --grep "@smoke"

# Specific category
npx playwright test tests/security.spec.ts
npx playwright test tests/mobile.spec.ts --project=mobile

# Load tests
k6 run load-tests/api-load.js
k6 run load-tests/api-stress.js

# Docker (containerized)
docker compose up --build --exit-code-from tests
```
