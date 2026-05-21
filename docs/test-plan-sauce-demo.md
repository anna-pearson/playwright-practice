# Test Plan: Sauce Demo E-Commerce Application

**Application:** [saucedemo.com](https://www.saucedemo.com)
**Author:** Anna Pearson
**Date:** 2026-05-21
**Status:** Active

---

## 1. Overview

Sauce Demo is a third-party e-commerce web application used as a testing sandbox. This test plan covers functional E2E testing of the core shopping flow: authentication, product browsing, cart management, and checkout. The goal is to validate that the critical purchase path works correctly and that common failure modes are handled gracefully.

We do not own this application. We have no access to the source code, backend, database, or deployment pipeline. All testing is black-box, driven entirely by the UI.

---

## 2. Scope

### In scope

- Login/authentication (valid, invalid, locked, edge cases)
- Product inventory display and sorting
- Add to cart / remove from cart
- Cart page contents and state
- Checkout flow (info form, summary, confirmation)
- Cross-browser testing (Chromium, Firefox, WebKit)

### Out of scope

- Payment processing (Sauce Demo has no real payment integration)
- Account creation/registration (no signup flow exists)
- Backend/API testing (no documented API, no access)
- Performance and load testing (third-party infrastructure we don't control)
- Mobile native app testing (web only)
- Accessibility (no WCAG commitment from the vendor, but we note any obvious issues)
- Visual regression (the vendor may change styling at any time without notice, making baselines unreliable)

### Why these boundaries

We focus on what a real customer touches: browse, add to cart, buy. We skip areas where we have no control or observability. Testing Sauce Demo's server performance would tell us about *their* infrastructure, not our application quality.

---

## 3. Environment & Test Data

### Browsers

| Browser | Viewport | Why |
|---------|----------|-----|
| Chromium | 1280x720 (desktop) | Largest browser market share |
| Firefox | 1280x720 (desktop) | Second-largest, different rendering engine |
| WebKit | 1280x720 (desktop) | Safari engine, catches WebKit-specific bugs |

Mobile viewport testing is excluded for Sauce Demo because the site is not responsive -- it renders the same layout at all screen sizes.

### Test accounts

Sauce Demo provides pre-configured users with different behaviors. This is our only test data -- we cannot create accounts or modify server state.

| Username | Password | Behavior | Use in testing |
|----------|----------|----------|----------------|
| `standard_user` | `secret_sauce` | Normal behavior | Happy path, all functional tests |
| `locked_out_user` | `secret_sauce` | Login blocked | Login error handling |
| `problem_user` | `secret_sauce` | Broken images, form bugs | Known defect exploration |
| `performance_glitch_user` | `secret_sauce` | Delayed responses | Timeout resilience |
| `error_user` | `secret_sauce` | Server errors on some actions | Error handling |
| `visual_user` | `secret_sauce` | Visual inconsistencies | Visual bug detection |

### Prerequisites

- Network access to saucedemo.com (external dependency)
- Playwright installed with all browser engines
- No server-side setup needed (third-party hosted)

---

## 4. Risk Assessment

Risk is evaluated on two axes: **likelihood** (how often could this break) and **impact** (how bad is it if it does).

| Risk Area | Likelihood | Impact | Mitigation |
|-----------|-----------|--------|------------|
| **Checkout completes but order is wrong** | Low | Critical | Verify item names and prices carry through from cart to summary |
| **Login blocks valid users** | Low | Critical | Test standard_user on every run as a smoke test |
| **Cart loses items between pages** | Medium | High | Verify cart badge count persists across navigation |
| **Sort breaks product display** | Medium | Medium | Verify sort order is correct, not just that the page doesn't crash |
| **DOM changes break selectors** | High | High | Use data-test attributes and semantic selectors where possible; avoid brittle CSS selectors |
| **Site goes down or changes behavior** | Medium | High | CI retries once on failure; flaky failures are investigated before being dismissed |
| **Price calculation is wrong at checkout** | Low | Critical | Verify item total + tax = displayed total on summary page |

### Highest risk area

**The cart-to-checkout transition.** This is where multiple pieces of state must stay in sync: the items you added, their prices, the quantities, and the user's shipping info. A bug here means a customer pays for the wrong thing or gets an error at the worst possible moment (after they've committed to buying).

---

## 5. Test Approach

### Automation strategy

All tests in this plan are automated with Playwright. We chose automation over manual testing because:

- The test scenarios are deterministic and repeatable
- We need cross-browser coverage (3 browsers x every test)
- Regression testing on every code push requires speed
- Manual testing doesn't scale for CI/CD

### What stays manual

- Exploratory testing with `problem_user` and `visual_user` accounts (defects are unpredictable, hard to assert on)
- Evaluating whether visual inconsistencies are bugs or intentional changes (requires human judgment)

### Test structure

- **Page Object Model** for login page (reused across all tests that require authentication)
- **`beforeEach` hooks** to handle login for non-login tests (keeps tests focused on their actual scope)
- **No shared state between tests** -- each test gets a fresh browser context
- **No API setup/teardown** -- we can't reset server state, so tests must be independent

### Selector strategy

Sauce Demo provides `data-test` attributes on key elements. We prefer these over CSS classes because:

- They survive styling changes
- They signal developer intent ("this element is meant to be tested")
- They're less likely to be renamed in refactors

Fallback order: `data-test` attribute > `role` + accessible name > visible text > CSS class (last resort).

---

## 6. Test Cases by Priority

### P0 — Critical Path (must pass, blocks release)

These tests represent the core purchase flow. If any fail, a customer cannot complete a purchase.

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| L-01 | Valid login | Enter standard_user / secret_sauce, click Login | Redirected to /inventory.html |
| L-02 | Locked user sees error | Enter locked_out_user / secret_sauce, click Login | Error message displayed, no redirect |
| I-01 | Inventory loads | Log in as standard_user | 6 products visible with names and prices |
| C-01 | Add item to cart | Click "Add to cart" on first product | Cart badge shows "1" |
| C-02 | Item appears in cart page | Add item, navigate to cart | Item name and price match inventory |
| K-01 | Complete checkout | Add item, go to cart, checkout, fill info, continue, finish | "Thank you for your order!" confirmation |
| K-02 | Checkout info validation | Go to checkout, click Continue with empty fields | Error message displayed |

### P1 — Important (should pass, investigate failures)

These tests cover secondary flows that affect user experience but don't block the core purchase path.

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| L-03 | Invalid password | Enter standard_user / wrong, click Login | Error message displayed |
| L-04 | Empty username | Leave username blank, enter password, click Login | Error message displayed |
| I-02 | Sort by price low-to-high | Select "Price (low to high)" from sort dropdown | Prices in ascending order |
| I-03 | Sort by name Z-to-A | Select "Name (Z to A)" from sort dropdown | Names in reverse alphabetical order |
| I-04 | Each product has name, price, and button | Inspect first product card | Name, price, and "Add to cart" button visible |
| C-03 | Remove item from cart | Add item, click "Remove" | Cart badge disappears |
| C-04 | Cart badge updates correctly | Add 2 items | Badge shows "2" |
| K-03 | Checkout shows correct item | Add specific item, go through to checkout summary | Item name on summary matches what was added |
| K-04 | Price total is correct | Add item, go to summary | Item price + tax = total |

### P2 — Edge Cases (nice to have, lower priority)

These tests probe less common scenarios. Failures here are worth logging but may not block a release.

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| C-05 | Add all 6 items to cart | Click "Add to cart" on every product | Badge shows "6", cart page lists all 6 |
| C-06 | Remove all items from cart | Add items, remove each one | Badge disappears, cart is empty |
| C-07 | Add and remove same item multiple times | Toggle add/remove 5 times | Final state matches last action |
| K-05 | Checkout with multiple items | Add 3 items, complete checkout | Confirmation shown, all items on summary |
| L-05 | Login with performance_glitch_user | Enter credentials, click Login | Eventually redirects (may be slow) |
| I-05 | Sort preserves after navigation | Sort by price, go to cart, come back | Sort order is preserved (or reset -- document actual behavior) |
| N-01 | Direct URL access without login | Navigate to /inventory.html without logging in | Redirected to login page |

---

## 7. Assumptions & Dependencies

### Assumptions

- Sauce Demo will remain publicly accessible at saucedemo.com
- The pre-configured test accounts and their passwords will not change
- The application has 6 products (if this changes, inventory count tests will need updating)
- `data-test` attributes will remain stable across deployments
- The application is not under active development (it's a testing sandbox, not a production app)

### Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| saucedemo.com availability | Site could go down at any time | CI retries once on failure; don't block deployments on third-party test results |
| DOM structure | Vendor could change HTML without notice | Use data-test selectors where possible; review failures before assuming test is broken |
| Network latency | External site, variable response times | Set generous timeouts (30s); use Playwright auto-waiting |
| Test account behavior | Vendor could change user behaviors | Document expected behavior; update tests if accounts change |

### What happens when tests fail

1. **Single test fails once** -- CI retries it (configured: 1 retry in CI). If it passes on retry, it's flagged as flaky for investigation.
2. **Single test fails consistently** -- Check if Sauce Demo changed. Compare against the live site manually. If the site changed, update the test. If it didn't, file a bug.
3. **Multiple tests fail at once** -- Likely a site-wide issue (Sauce Demo is down, or they deployed a breaking change). Check site availability before investigating individual tests.
4. **All login tests fail** -- The test accounts may have changed. Check saucedemo.com manually.

---

## 8. What This Plan Doesn't Cover (and Why)

- **Security testing** -- No authorization to perform security testing against a third-party site.
- **Accessibility compliance** -- Sauce Demo makes no WCAG commitment. We'd be testing someone else's accessibility obligations.
- **Performance benchmarks** -- Response times depend on Sauce Demo's infrastructure, geographic location, and current load. Benchmarks would be meaningless.
- **Data persistence** -- Sauce Demo resets state per session. There's nothing to persist or verify across sessions.
- **Email/notification flows** -- No email verification, order confirmation, or notification features exist.