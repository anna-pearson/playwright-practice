# DJ Mix Player — Playwright Test Suite

[![Playwright Tests](https://github.com/anna-pearson/playwright-test-suite/actions/workflows/tests.yml/badge.svg)](https://github.com/anna-pearson/playwright-test-suite/actions/workflows/tests.yml)

825-test Playwright suite covering two web applications across Chromium, Firefox, WebKit, and mobile viewports. Tests span E2E, API, accessibility (axe-core WCAG 2.1 AA), visual regression, performance (Core Web Vitals), network interception, and keyboard navigation.

## The apps

**DJ Mix Player** — A single-page DJ player built with vanilla HTML/CSS/JS and an Express API. Features include a 6-track library with genre/BPM/key metadata, playback controls, volume with mute, search filtering, genre filters, keyboard shortcuts, waveform visualization, and responsive layout.

**Sauce Demo** — E2E tests against [saucedemo.com](https://www.saucedemo.com), a third-party e-commerce app. Covers login flows, inventory browsing, cart management, and full checkout.

## Test coverage

### DJ Player (172 tests)

| Category | Tests | What's covered |
|----------|-------|----------------|
| Page load & initial state | 13 | Title, track rendering, default UI state, volume |
| Tracklist content | 8 | Metadata accuracy for all 6 tracks, column headers, keyboard reachability |
| Track selection | 9 | Click, keyboard (Enter/Space), active state, auto-play |
| Playback controls | 14 | Play/pause, next/prev, wrapping, auto-advance, progress |
| Seeking | 4 | Keyboard seek, progress bar click, ARIA attributes |
| Volume controls | 11 | Slider, mute/unmute, persistence, icon state, boundary values |
| Mobile responsive | 1 | Volume controls hidden on mobile viewport |
| Search | 11 | Title/artist/genre/key filtering, case-insensitive, empty states |
| Genre filters | 8 | Single filter, combined with search, active state, clearing |
| Keyboard shortcuts | 14 | All shortcuts, focus guards, wrap-around, case-insensitive |
| Accessibility | 20 | ARIA labels/roles, regions, axe-core WCAG 2.1 AA scans |
| Edge cases | 11 | Rapid clicks, boundary conditions, viewport sizes, whitespace |
| Visual feedback | 4 | EQ bars on active track, volume persistence across tracks |
| Visual regression | 6 | Screenshot baselines: default, playing, filtered, search, no-results, muted |
| Drag seeking | 3 | Mousedown-mousemove-mouseup on progress bar, mid-drag state |
| Playback + filter interaction | 5 | Genre filter during playback, filtered-out track continues, search during playback |
| Track number display | 5 | Numeric indices, EQ bar replacement, renumbering on filter |
| Search input isolation | 4 | "m" key doesn't mute, Shift+Arrow doesn't skip while typing |
| Play/pause resilience | 4 | Multi-cycle toggle, rapid toggling, mid-playback track switch |
| Performance | 9 | TTFB, FCP, LCP, CLS, API latency, page weight, resource timing, long tasks |

### Sauce Demo (14 tests)

| Category | Tests | What's covered |
|----------|-------|----------------|
| Login | 4 | Valid credentials, locked user, invalid password, empty username |
| Inventory | 4 | Product count, metadata, sort by price, sort by name |
| Cart | 3 | Add to cart badge, item appears in cart, remove updates badge |
| Checkout | 3 | Navigation, empty form validation, full checkout flow |

### API (55 tests)

| Category | Tests | What's covered |
|----------|-------|----------------|
| GET endpoints | 10 | Status codes, content types, JSON structure, static assets |
| POST /api/tracks | 6 | Create track, validation, missing fields, empty body |
| PUT /api/tracks/:id | 7 | Update fields, partial update, validation, 404 |
| DELETE /api/tracks/:id | 4 | Delete track, 404, invalid ID |
| Filtering & search | 8 | Genre filter, search query, combined filters, no results |
| Error handling | 6 | 404 routes, invalid IDs, NaN IDs, empty strings |
| Concurrency | 2 | Parallel requests, create-then-read consistency |
| CRUD lifecycle | 1 | Full create-read-update-delete flow |
| Search edge cases | 7 | Case sensitivity, partial match, special characters, URL encoding |
| HEAD requests | 2 | Headers without body for API and HTML routes |

### Network Interception (10 tests)

| Category | Tests | What's covered |
|----------|-------|----------------|
| Network interception | 10 | CSS blocking, response modification, slow connections, asset verification, API error simulation |

### Cross-browser matrix

All E2E tests run across 4 browser projects (Chromium, Firefox, WebKit, mobile/iPhone 14), producing **825 total test runs** from 251 unique tests. API tests run once (no browser needed). Chromium-only tests (LCP, CLS, long tasks) are skipped on other browsers.

## Key patterns

### Audio stubbing

Replaces `HTMLAudioElement` with a controllable fake via `page.addInitScript()`, enabling headless CI without real media decoding:

```typescript
async function stubAudio(page: Page) {
  await page.addInitScript(() => {
    // Replace audio prototype methods with controllable fakes
    // Simulates play/pause, currentTime progression, ended events
  });
}
```

### Page Object Model

All locators are centralized in a `DjPlayerPage` class:

```typescript
const player = new DjPlayerPage(page);
await player.goto();
await player.clickTrack(0);
await expect(player.trackTitle).toHaveText('Midnight Sessions');
```

### Visual regression

Screenshot baselines per browser/OS, with waveform canvas masked to prevent false positives:

```typescript
await expect(page).toHaveScreenshot('playing-state.png', {
  mask: [player.waveform],
});
```

### Performance via Web Vitals

Measures Core Web Vitals using the browser's Performance API and PerformanceObserver:

```typescript
await page.addInitScript(() => {
  (window as any).__cls = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!(entry as any).hadRecentInput) {
        (window as any).__cls += (entry as any).value;
      }
    }
  }).observe({ type: 'layout-shift', buffered: true });
});
```

### Network interception

Uses `page.route()` to test how the app handles degraded network conditions:

```typescript
await page.route('**/styles.css', (route) => route.abort());
await page.goto('/');
await expect(page.getByRole('listitem')).toHaveCount(6);
```

### Conditional test execution

Tests skip gracefully when they don't apply to the current browser project:

```typescript
test('volume slider defaults to 80', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Volume controls are hidden on mobile');
  // ...
});
```

## Running tests

```bash
# Install dependencies
npm install
npx playwright install

# Run all tests (all browsers)
npx playwright test

# Run a single browser
npx playwright test --project=chromium

# Run a specific category
npx playwright test -g "Performance"

# Run with visible browser
npx playwright test --headed

# Update visual regression baselines
npx playwright test --update-snapshots -g "Visual regression"
```

## CI

Tests run automatically on every push via GitHub Actions. The workflow installs dependencies, sets up Playwright browsers, starts the Express server, and runs the full suite with HTML reporting and failure artifacts.

## Built with

- [Playwright](https://playwright.dev/) — Browser testing framework
- [axe-core](https://github.com/dequelabs/axe-core) — Accessibility scanning (WCAG 2.1 AA)
- [TypeScript](https://www.typescriptlang.org/)
- [Express](https://expressjs.com/) — API server
- [GitHub Actions](https://github.com/features/actions) — CI/CD
