# Test Plan: MixDeck DJ Mix Player

**Application:** MixDeck — a browser-based DJ track library and audio player
**Author:** Anna Pearson
**Date:** 2026-05-27
**Status:** Active

---

## 1. Overview

MixDeck is a single-page web application that lets users browse a track library, filter and search tracks, and play audio with transport and volume controls. It consists of a Node.js/Express API server and a vanilla JavaScript frontend.

This test plan covers the full testing strategy for MixDeck: functional E2E testing, API testing, security testing, accessibility compliance, performance measurement, mobile responsiveness, and load testing. We own the application, the source code, the server, and the deployment pipeline — giving us full white-box testing capability.

---

## 2. Scope

### In scope

| Area | What's tested |
|------|---------------|
| **API (REST)** | CRUD operations, filtering, search, validation, error handling, response contracts |
| **E2E (browser)** | Track library, playback, search, genre filters, keyboard shortcuts, visual regression |
| **Cross-browser** | Chromium, Firefox, WebKit, mobile viewport (iPhone 14) |
| **Security** | XSS, injection, path traversal, prototype pollution, type coercion, HTTP method abuse |
| **Accessibility** | WCAG 2.1 AA compliance via axe-core, semantic HTML, keyboard navigation, touch targets |
| **Performance** | Core Web Vitals (FCP, LCP, CLS), long task detection |
| **Load testing** | API throughput under concurrent users (k6, up to 200 virtual users) |
| **Mobile** | Responsive layout, touch interactions, readable text, hidden desktop-only controls |

### Out of scope

- **Authentication/authorization** — MixDeck has no user accounts or login
- **Database testing** — the server uses in-memory storage, not a persistent database
- **Payment/transactions** — no commerce features exist
- **Internationalization (i18n)** — single-language application
- **Offline/PWA** — no service worker or offline capability
- **Unit tests** — developer responsibility; this plan covers integration and E2E

### Why these boundaries

We test what users interact with and what could break in production. Auth, database, and i18n are out of scope because the features don't exist — not because they're unimportant. If MixDeck adds user accounts or persistent storage, this plan should be revised.

---

## 3. Environment & Test Data

### Architecture

```
Browser (frontend)  ←→  Express server (API + static files)
    app/                     server.js
    ├── index.html           └── /api/tracks (CRUD)
    ├── app.js                   /api/tracks/reset (test helper)
    └── styles.css
```

### Browsers

| Browser | Viewport | Why |
|---------|----------|-----|
| Chromium | 1280x720 | Largest market share, Performance API support |
| Firefox | 1280x720 | Gecko engine, catches rendering differences |
| WebKit | 1280x720 | Safari engine, catches WebKit-specific bugs |
| Mobile (iPhone 14) | 390x844 | Mobile responsive behavior, touch targets |

### Test data

The server ships with 6 default tracks, each with a unique genre:

| ID | Title | Genre | Key | BPM |
|----|-------|-------|-----|-----|
| 1 | Midnight Sessions | Deep House | Am | 122 |
| 2 | Warehouse Echoes | Techno | Dm | 138 |
| 3 | Liquid Sunshine | Drum & Bass | Fm | 174 |
| 4 | Cloud Nine | Progressive House | Cm | 128 |
| 5 | Neon Dreams | Synthwave | Em | 110 |
| 6 | Bass Culture | UK Garage | Gm | 130 |

**Reset strategy:** `POST /api/tracks/reset` restores default data before each test. This endpoint exists solely for testing — it would not exist in a production deployment.

**Test data factory:** `tests/helpers/test-data.ts` provides `createTrack()` and `createInvalidTrack()` functions for generating randomized but realistic test data with partial overrides.

### Prerequisites

- Node.js 22+
- Playwright browsers installed (`npx playwright install`)
- k6 installed (load tests only)
- Docker (containerized tests only)

---

## 4. Risk Assessment

| Risk Area | Likelihood | Impact | Mitigation |
|-----------|-----------|--------|------------|
| **XSS via track input** | Medium | Critical | Stored XSS test verifies scripts are returned as data, not executed in browser |
| **API accepts malformed data** | Medium | High | Contract tests validate every response shape; validation tests cover missing/empty/wrong-type fields |
| **Playback breaks across browsers** | Medium | High | Audio is stubbed in tests — we test UI behavior, not codec support |
| **Search returns wrong results** | Low | Medium | Data-driven tests cover 7 search scenarios including edge cases |
| **Layout breaks on mobile** | Medium | Medium | Mobile viewport tests check hidden elements, touch targets, scrollbar overflow |
| **Performance degrades** | Low | Medium | Core Web Vitals tests set thresholds for FCP (<1.5s), LCP (<2.5s), CLS (<0.1) |
| **Server crashes under load** | Low | High | k6 stress tests ramp to 200 VUs with failure thresholds |
| **Test data races between workers** | High | Low | Local runs use 1 worker; CI uses 2 workers + 1 retry |
| **Server exposes version info** | Confirmed | Medium | Documented in bug report SEC-001; `X-Powered-By: Express` header is exposed |

### Highest risk area

**User-supplied input flowing through the API to the browser.** MixDeck accepts arbitrary strings for track titles and artist names. If the server or frontend fails to handle these safely, stored XSS is possible. Our security tests verify that `<script>` tags submitted via POST are stored and returned as text, never executed.

---

## 5. Test Approach

### Automation strategy

All tests are automated with Playwright (E2E, API, security, accessibility, performance, visual regression) and k6 (load/stress). The full suite runs in CI on every push to main.

| Layer | Tool | Count | Run time |
|-------|------|-------|----------|
| API tests | Playwright APIRequestContext | 93 | ~5s |
| E2E (chromium) | Playwright | 234 | ~40s |
| E2E (firefox) | Playwright | CI only | ~40s |
| E2E (webkit) | Playwright | CI only | ~40s |
| Mobile | Playwright (iPhone 14) | CI only | ~35s |
| Load/stress | k6 | 2 scripts | ~45s |
| **Total (local)** | | **327** | **~48s** |
| **Total (CI, all browsers)** | | **1,083** | **~90s** |

### What stays manual

- **Exploratory testing** — probing interactions that are hard to predict and automate (e.g., rapid UI interactions, unusual browser states)
- **Visual judgment** — deciding whether a layout change is a bug or an improvement
- **Audio quality** — tests use a stubbed audio element; actual audio playback requires human ears

### Test tiers

| Tier | Tag | Tests | When to run |
|------|-----|-------|-------------|
| **Smoke** | `@smoke` | 12 | Pre-commit hook (automatic), quick validation |
| **Full (local)** | — | 327 | Before push, chromium + API only |
| **Full (CI)** | — | 1,083 | Every push/PR, all browsers |
| **Load** | — | 2 k6 scripts | CI pipeline, separate job |
| **Flaky detection** | — | 5x full run | Manual trigger via workflow_dispatch |

### Audio stubbing

The browser's `HTMLAudioElement` is replaced with a controllable fake before each E2E test. This lets us test play/pause, track switching, seek, and volume without real audio files or codec dependencies. The stub is defined in `dj-player.spec.ts` and `mobile.spec.ts`.

### Selector strategy

Priority order:
1. **ARIA roles + accessible names** — `getByRole('button', { name: 'Play' })`
2. **Semantic locators** — `getByText()`, `getByLabel()`
3. **CSS class** — `.no-results`, `.track-title` (only when no semantic alternative exists)

We avoid `data-testid` in this project because semantic selectors also validate accessibility — a button that can't be found by role is an accessibility bug.

---

## 6. Test Cases by Priority

### P0 — Critical Path (must pass, blocks release)

| ID | Area | Test Case | File |
|----|------|-----------|------|
| API-01 | API | GET /api/tracks returns all 6 tracks | api.spec.ts |
| API-02 | API | POST creates a track and returns 201 | api.spec.ts |
| API-03 | API | Full CRUD lifecycle (create → read → update → delete) | api.spec.ts |
| API-04 | API | Response matches zod schema contract | api.spec.ts |
| E2E-01 | UI | Page loads with correct title | dj-player.spec.ts |
| E2E-02 | UI | All 6 tracks render in the library | dj-player.spec.ts |
| E2E-03 | UI | Clicking a track updates the now-playing panel | dj-player.spec.ts |
| E2E-04 | UI | Play/pause button toggles state | dj-player.spec.ts |
| E2E-05 | UI | Search filters tracks in real time | dj-player.spec.ts |
| SEC-01 | Security | Stored XSS payload is not executed in browser | security.spec.ts |
| A11Y-01 | Accessibility | axe-core scan passes WCAG 2.1 AA | dj-player.spec.ts |

### P1 — Important (should pass, investigate failures)

| ID | Area | Test Case | File |
|----|------|-----------|------|
| API-05 | API | Search is case-insensitive | api.spec.ts |
| API-06 | API | POST rejects missing required fields (400) | api.spec.ts |
| API-07 | API | PUT partial update preserves unchanged fields | api.spec.ts |
| E2E-06 | UI | Genre filter shows only matching tracks | dj-player.spec.ts |
| E2E-07 | UI | Next/previous track buttons work | dj-player.spec.ts |
| E2E-08 | UI | Volume slider and mute/unmute toggle | dj-player.spec.ts |
| E2E-09 | UI | Keyboard shortcuts (Space, M, arrows) | dj-player.spec.ts |
| NET-01 | Resilience | App handles unreachable API without crashing | network-interception.spec.ts |
| NET-02 | Resilience | App handles slow API response | network-interception.spec.ts |
| MOB-01 | Mobile | No horizontal scrollbar at mobile viewport | mobile.spec.ts |
| MOB-02 | Mobile | Touch targets meet WCAG AA minimum (24px) | mobile.spec.ts |
| PERF-01 | Performance | First Contentful Paint < 1.5s | dj-player.spec.ts |
| PERF-02 | Performance | Largest Contentful Paint < 2.5s | dj-player.spec.ts |

### P2 — Edge Cases (nice to have)

| ID | Area | Test Case | File |
|----|------|-----------|------|
| API-08 | API | Oversized JSON payload (1MB) returns 413 or is handled | security.spec.ts |
| API-09 | API | DELETE on nonexistent ID returns 404 | api.spec.ts |
| API-10 | API | Path traversal in ID parameter is rejected | security.spec.ts |
| E2E-10 | UI | Rapid genre switching doesn't break the tracklist | dj-player.spec.ts |
| E2E-11 | UI | Playing track remains highlighted after filtering | dj-player.spec.ts |
| SEC-02 | Security | Prototype pollution via __proto__ is rejected | security.spec.ts |
| LOAD-01 | Load | API handles 50 concurrent requests | security.spec.ts |
| LOAD-02 | Stress | API sustains 200 virtual users for 30s | load-tests/api-stress.js |

---

## 7. CI/CD Pipeline

### Pipeline structure

```
Push/PR to main
    ├── Job 1: Playwright Tests (all browsers, ~90s)
    ├── Job 2: k6 Load Tests (~45s)
    └── Job 3: Docker Build & Test (~60s)
```

All 3 jobs run in parallel. The pipeline passes only if all 3 succeed.

### Artifacts

| Artifact | Retention | Purpose |
|----------|-----------|---------|
| `playwright-report/` | 30 days | HTML report with screenshots, traces, and video |
| `test-summary.md` | Generated each run | Markdown summary of pass/fail/skip by file and browser |
| `flaky-report.md` | 30 days | Flaky test detection results (manual trigger only) |

### Flaky test detection

A fourth CI job (`flaky-detection`) runs the full suite 5 times and compares results. Tests that pass on some runs and fail on others are flagged. This job is manual-trigger only via `workflow_dispatch` to avoid unnecessary CI cost.

---

## 8. Entry & Exit Criteria

### Entry criteria (before testing begins)

- [ ] Server starts without errors (`node server.js`)
- [ ] All 6 default tracks load via `GET /api/tracks`
- [ ] Playwright browsers are installed
- [ ] No blocking bugs from previous release are unresolved

### Exit criteria (testing is complete)

- [ ] All P0 tests pass
- [ ] All P1 tests pass or have documented reasons for failure
- [ ] No critical or high-severity bugs remain open
- [ ] axe-core scan reports 0 WCAG 2.1 AA violations
- [ ] Core Web Vitals meet thresholds (FCP < 1.5s, LCP < 2.5s, CLS < 0.1)
- [ ] Load test thresholds pass (p95 < 500ms at 50 concurrent users)
- [ ] Test summary report is generated and reviewed

---

## 9. Known Issues

| ID | Issue | Severity | Status | Notes |
|----|-------|----------|--------|-------|
| SEC-001 | `X-Powered-By: Express` header exposed | Medium | Open | Documented in docs/bug-report-x-powered-by.md. Fix: `app.disable('x-powered-by')` |
| A11Y-001 | `aria-label` on `<span>` without explicit role | Low | Open | axe-core flags as "incomplete" — needs review |
| A11Y-002 | Color contrast on logo gradient | Low | Open | axe-core cannot compute contrast on gradients — manual review passed |
| DATA-001 | API search includes key field; frontend search includes key field; but behavior differs between them | Low | Open | Server searches title/artist/genre. Frontend searches title/artist/genre/key. |

---

## 10. Assumptions & Dependencies

### Assumptions

- The application runs on localhost:4173 (configurable via `BASE_URL` env var)
- The in-memory data store resets on server restart
- Audio playback is not testable in headless browsers — we test the UI controls, not the audio output
- Visual regression baselines are OS-specific (generated on macOS, CI runs Linux) — screenshot comparisons are skipped in CI

### Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Node.js 22 | Low | Pinned in CI via `actions/setup-node` |
| Playwright browsers | Low | Installed in CI via `npx playwright install --with-deps` |
| k6 | Low | Installed via apt in CI |
| Express.js | Low | No external runtime dependencies beyond Express |
| In-memory data store | Medium | Tests reset state via `/api/tracks/reset`; parallel workers can race (mitigated by single worker locally) |
