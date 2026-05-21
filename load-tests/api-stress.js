import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─────────────────────────────────────────────────────────────────────────────
// API STRESS TEST — FIND THE BREAKING POINT
// Ramps aggressively from 10 to 200 virtual users to find where the API
// starts degrading: slower responses, dropped requests, or errors.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';

// ── Custom metrics ──────────────────────────────────────────────────────────
const errorRate = new Rate('errors');
const slowRequests = new Counter('slow_requests');   // requests > 100ms
const verySlowRequests = new Counter('very_slow_requests'); // requests > 500ms

// ── Aggressive ramp-up to find the ceiling ──────────────────────────────────
export const options = {
  stages: [
    { duration: '10s', target: 10 },    // baseline: 10 users
    { duration: '10s', target: 50 },    // ramp: 50 users
    { duration: '10s', target: 100 },   // push: 100 users
    { duration: '10s', target: 150 },   // heavy: 150 users
    { duration: '15s', target: 200 },   // stress: 200 users
    { duration: '15s', target: 200 },   // hold at peak
    { duration: '10s', target: 0 },     // cool down
  ],

  // Intentionally tight thresholds — we WANT some to fail so we can see
  // where the API starts struggling
  thresholds: {
    http_req_duration: [
      { threshold: 'p(50)<10', abortOnFail: false },     // median under 10ms
      { threshold: 'p(95)<50', abortOnFail: false },     // 95th under 50ms
      { threshold: 'p(99)<200', abortOnFail: false },    // 99th under 200ms
      { threshold: 'max<1000', abortOnFail: false },     // no request over 1s
    ],
    http_req_failed: [
      { threshold: 'rate<0.01', abortOnFail: false },    // under 1% errors
    ],
    errors: [
      { threshold: 'rate<0.01', abortOnFail: false },
    ],
    slow_requests: [
      { threshold: 'count<10', abortOnFail: false },     // fewer than 10 slow requests
    ],
  },
};

// ── Main test function ──────────────────────────────────────────────────────

export default function () {
  const scenario = Math.random();

  if (scenario < 0.5) {
    // 50% reads — most common real-world pattern
    getAllTracks();
  } else if (scenario < 0.7) {
    // 20% single track lookups
    getTrackById();
  } else if (scenario < 0.85) {
    // 15% searches
    searchTracks();
  } else {
    // 15% writes — creates contention on shared state
    createAndDelete();
  }

  // Minimal sleep — hammer the server
  sleep(0.1 + Math.random() * 0.3);
}

// ── Scenarios ───────────────────────────────────────────────────────────────

function getAllTracks() {
  const res = http.get(`${BASE_URL}/api/tracks`);
  trackSlowness(res);

  const passed = check(res, {
    'GET /api/tracks: status 200': (r) => r.status === 200,
    'GET /api/tracks: is array': (r) => Array.isArray(r.json()),
  });
  errorRate.add(!passed);
}

function getTrackById() {
  const id = Math.floor(Math.random() * 6) + 1;
  const res = http.get(`${BASE_URL}/api/tracks/${id}`);
  trackSlowness(res);

  const passed = check(res, {
    'GET /api/tracks/:id: status 200': (r) => r.status === 200,
    'GET /api/tracks/:id: has title': (r) => typeof r.json().title === 'string',
  });
  errorRate.add(!passed);
}

function searchTracks() {
  const queries = ['midnight', 'bass', 'DJ', 'techno', 'cloud', 'neon', 'liquid', 'warehouse'];
  const query = queries[Math.floor(Math.random() * queries.length)];
  const res = http.get(`${BASE_URL}/api/tracks?search=${query}`);
  trackSlowness(res);

  const passed = check(res, {
    'search: status 200': (r) => r.status === 200,
    'search: is array': (r) => Array.isArray(r.json()),
  });
  errorRate.add(!passed);
}

function createAndDelete() {
  // Create a track
  const createRes = http.post(
    `${BASE_URL}/api/tracks`,
    JSON.stringify({
      title: `Stress ${Date.now()}-${Math.random()}`,
      artist: 'k6',
      bpm: 128,
      genre: 'Test',
      key: 'Am',
      duration: 10,
      freq: 220,
      color: '#ff0000',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  trackSlowness(createRes);

  const createPassed = check(createRes, {
    'POST: status 201': (r) => r.status === 201,
  });

  if (!createPassed) {
    errorRate.add(true);
    return;
  }

  // Immediately delete it — prevents the tracks array from growing forever
  // which would slow down GET /api/tracks over time
  const id = createRes.json().id;
  const deleteRes = http.del(`${BASE_URL}/api/tracks/${id}`);
  trackSlowness(deleteRes);

  const deletePassed = check(deleteRes, {
    'DELETE: status 204': (r) => r.status === 204,
  });
  errorRate.add(!deletePassed);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function trackSlowness(res) {
  if (res.timings.duration > 100) {
    slowRequests.add(1);
  }
  if (res.timings.duration > 500) {
    verySlowRequests.add(1);
  }
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

export function setup() {
  http.post(`${BASE_URL}/api/tracks/reset`);
}

export function teardown() {
  http.post(`${BASE_URL}/api/tracks/reset`);
}
