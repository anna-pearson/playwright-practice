# DJ Mix Player — QA Test Suite

[![QA Pipeline](https://github.com/anna-pearson/playwright-test-suite/actions/workflows/tests.yml/badge.svg)](https://github.com/anna-pearson/playwright-test-suite/actions/workflows/tests.yml)

**1,058 automated tests** across 6 test files, covering E2E, API, security, accessibility, performance, visual regression, mobile responsiveness, network interception, and load testing. Runs across Chromium, Firefox, WebKit, and mobile viewports via a 3-job parallel CI/CD pipeline.

## Architecture

```
├── tests/
│   ├── dj-player.spec.ts       # 172 E2E tests (page object model)
│   ├── api.spec.ts             # 68 API + contract tests (zod schemas)
│   ├── security.spec.ts        # 39 security tests (XSS, injection, abuse)
│   ├── mobile.spec.ts          # 16 mobile-specific tests
│   ├── network-interception.spec.ts  # 10 network tests
│   ├── sauce-demo.spec.ts      # 14 third-party e-commerce tests
│   └── helpers/
│       └── test-data.ts        # Test data factory
├── load-tests/
│   ├── api-load.js             # k6 load test (30 VUs)
│   └── api-stress.js           # k6 stress test (200 VUs)
├── docs/
│   ├── test-plan-sauce-demo.md # Formal test plan
│   ├── test-coverage-matrix.md # Feature-to-test mapping
│   ├── accessibility-audit.md  # WCAG 2.1 AA audit report
│   └── bug-report-x-powered-by.md  # Security finding
├── Dockerfile                  # Multi-stage build (app + tests)
├── docker-compose.yml          # Containerized test execution
└── .github/workflows/tests.yml # 3-job parallel CI pipeline
```

## Test Categories

| Category | Tests | What it proves |
|----------|-------|----------------|
| E2E (DJ Player) | 172 | Full user journey testing with page objects |
| API + Contract | 68 | REST validation + zod schema enforcement |
| Security | 39 | XSS, injection, path traversal, prototype pollution |
| Mobile | 16 | Responsive layout, touch targets, breakpoint behavior |
| Network Interception | 10 | Graceful degradation, error handling |
| Sauce Demo | 14 | Testing against third-party apps |
| Performance | 9 | Core Web Vitals (FCP, LCP, CLS, TTFB) |
| Visual Regression | 6 | Screenshot baselines across browsers |
| Accessibility | 18 | ARIA, axe-core WCAG 2.1 AA scans |
| Load Testing | 2 suites | k6 stress testing to 200 concurrent users |

## CI/CD Pipeline

Three jobs run in parallel on every push:

| Job | What it does | Time |
|-----|--------------|------|
| **Playwright Tests** | Full suite across all browsers (excludes visual regression + sauce-demo in CI) | ~7 min |
| **k6 Load Tests** | Runs load + stress tests against the Express API | ~3 min |
| **Docker Build & Test** | Builds containers and runs the suite in Docker | ~2 min |

## Smoke Tests

12 critical tests tagged `@smoke` for fast validation (~3 seconds):

```bash
npx playwright test --grep "@smoke"
```

Covers: page load, track selection, playback, search, genre filter, API CRUD, XSS protection, error handling, and WCAG compliance.

## Key Patterns

### Page Object Model
```typescript
const player = new DjPlayerPage(page);
await player.goto();
await player.clickTrack(0);
await expect(player.trackTitle).toHaveText('Midnight Sessions');
```

### Contract Testing (zod)
```typescript
const TrackSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
const result = TrackListSchema.safeParse(await response.json());
expect(result.success, formatZodError(result)).toBe(true);
```

### Security Testing
```typescript
test('@smoke stored XSS payload is returned as-is in GET (not executed)', async ({ page, request }) => {
  await request.post('/api/tracks', {
    data: { title: '<script>window.__xss=true</script>', artist: 'Test' },
  });
  await page.goto('/');
  const xssRan = await page.evaluate(() => (window as any).__xss);
  expect(xssRan).toBeUndefined();
});
```

### Performance (Core Web Vitals)
```typescript
await page.addInitScript(() => {
  (window as any).__cls = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!(entry as any).hadRecentInput)
        (window as any).__cls += (entry as any).value;
    }
  }).observe({ type: 'layout-shift', buffered: true });
});
```

### Test Data Factory
```typescript
import { createTrack, createInvalidTrack } from './helpers/test-data';

const track = createTrack({ bpm: 200, genre: 'Trance' });
const invalid = createInvalidTrack('no-title');
```

## Running Tests

```bash
# Full suite (all browsers)
npx playwright test

# Smoke tests only (~3 seconds)
npx playwright test --grep "@smoke"

# Single category
npx playwright test tests/security.spec.ts
npx playwright test tests/mobile.spec.ts --project=mobile

# Load testing
k6 run load-tests/api-load.js
k6 run load-tests/api-stress.js

# Docker (containerized)
docker compose up --build --exit-code-from tests

# Visual regression baselines
npx playwright test --update-snapshots -g "Visual regression"
```

## Documentation

| Document | Purpose |
|----------|---------|
| [Test Plan](docs/test-plan-sauce-demo.md) | Formal test plan with scope, risk assessment, and P0/P1/P2 prioritization |
| [Coverage Matrix](docs/test-coverage-matrix.md) | Feature-to-test mapping with gap analysis |
| [Accessibility Audit](docs/accessibility-audit.md) | WCAG 2.1 AA compliance report (36 rules passed) |
| [Bug Report](docs/bug-report-x-powered-by.md) | Security finding: X-Powered-By header disclosure |

## Built With

- [Playwright](https://playwright.dev/) — Cross-browser test automation
- [axe-core](https://github.com/dequelabs/axe-core) — WCAG accessibility scanning
- [zod](https://zod.dev/) — API contract schema validation
- [k6](https://k6.io/) — Load and stress testing
- [Docker](https://www.docker.com/) — Containerized test execution
- [GitHub Actions](https://github.com/features/actions) — CI/CD pipeline
- [TypeScript](https://www.typescriptlang.org/) — Type-safe test code
- [Express](https://expressjs.com/) — API server under test
