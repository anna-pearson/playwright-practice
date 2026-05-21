import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─────────────────────────────────────────────────────────────────────────────
// API LOAD TESTS
// Stress-tests the Express API with concurrent virtual users to measure
// response times, throughput, and error rates under load.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';

// ── Custom metrics ──────────────────────────────────────────────────────────
const errorRate = new Rate('errors');
const getTracksDuration = new Trend('get_tracks_duration');
const getTrackByIdDuration = new Trend('get_track_by_id_duration');
const createTrackDuration = new Trend('create_track_duration');
const searchDuration = new Trend('search_duration');

// ── Test configuration ──────────────────────────────────────────────────────
export const options = {
  // Ramp up → steady state → spike → ramp down
  stages: [
    { duration: '10s', target: 10 },   // warm up: ramp to 10 users
    { duration: '20s', target: 10 },   // steady state: hold at 10
    { duration: '10s', target: 30 },   // stress: ramp to 30 users
    { duration: '20s', target: 30 },   // stress: hold at 30
    { duration: '10s', target: 0 },    // cool down: ramp to 0
  ],

  // Pass/fail thresholds
  thresholds: {
    http_req_duration: ['p(95)<500'],    // 95th percentile under 500ms
    http_req_failed: ['rate<0.05'],      // less than 5% errors
    errors: ['rate<0.05'],               // custom error rate under 5%
    get_tracks_duration: ['p(95)<300'],  // GET /api/tracks fast
    get_track_by_id_duration: ['p(95)<200'],
    create_track_duration: ['p(95)<400'],
    search_duration: ['p(95)<300'],
  },
};

// ── Test scenarios ──────────────────────────────────────────────────────────

export default function () {
  // Weighted random selection of scenarios — simulates realistic traffic
  const scenario = Math.random();

  if (scenario < 0.4) {
    getAllTracks();
  } else if (scenario < 0.6) {
    getTrackById();
  } else if (scenario < 0.75) {
    searchTracks();
  } else if (scenario < 0.85) {
    filterByGenre();
  } else if (scenario < 0.95) {
    createTrack();
  } else {
    fullCrudFlow();
  }

  sleep(0.5 + Math.random() * 1); // realistic pause between actions
}

// ── Scenario implementations ────────────────────────────────────────────────

function getAllTracks() {
  const res = http.get(`${BASE_URL}/api/tracks`);

  getTracksDuration.add(res.timings.duration);

  const passed = check(res, {
    'GET /api/tracks returns 200': (r) => r.status === 200,
    'GET /api/tracks returns array': (r) => Array.isArray(r.json()),
    'GET /api/tracks returns 6 tracks': (r) => r.json().length >= 1,
    'GET /api/tracks has JSON content-type': (r) =>
      r.headers['Content-Type'].includes('application/json'),
  });

  errorRate.add(!passed);
}

function getTrackById() {
  const id = Math.floor(Math.random() * 6) + 1;
  const res = http.get(`${BASE_URL}/api/tracks/${id}`);

  getTrackByIdDuration.add(res.timings.duration);

  const passed = check(res, {
    'GET /api/tracks/:id returns 200': (r) => r.status === 200,
    'track has id field': (r) => r.json().id === id,
    'track has title': (r) => typeof r.json().title === 'string',
    'track has bpm': (r) => typeof r.json().bpm === 'number',
  });

  errorRate.add(!passed);
}

function searchTracks() {
  const queries = ['midnight', 'bass', 'DJ', 'techno', 'cloud', 'neon'];
  const query = queries[Math.floor(Math.random() * queries.length)];
  const res = http.get(`${BASE_URL}/api/tracks?search=${query}`);

  searchDuration.add(res.timings.duration);

  const passed = check(res, {
    'search returns 200': (r) => r.status === 200,
    'search returns array': (r) => Array.isArray(r.json()),
  });

  errorRate.add(!passed);
}

function filterByGenre() {
  const genres = ['Techno', 'Deep House', 'Drum & Bass', 'Synthwave', 'UK Garage', 'Progressive House'];
  const genre = genres[Math.floor(Math.random() * genres.length)];
  const res = http.get(`${BASE_URL}/api/tracks?genre=${encodeURIComponent(genre)}`);

  const passed = check(res, {
    'genre filter returns 200': (r) => r.status === 200,
    'genre filter returns array': (r) => Array.isArray(r.json()),
    'all results match genre': (r) =>
      r.json().every((t) => t.genre === genre),
  });

  errorRate.add(!passed);
}

function createTrack() {
  const payload = JSON.stringify({
    title: `Load Test Track ${Date.now()}`,
    artist: 'k6 Virtual User',
    bpm: 120 + Math.floor(Math.random() * 60),
    genre: 'Test',
    key: 'Am',
    duration: 15,
    freq: 220,
    color: '#ff00ff',
  });

  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(`${BASE_URL}/api/tracks`, payload, params);

  createTrackDuration.add(res.timings.duration);

  const passed = check(res, {
    'POST returns 201': (r) => r.status === 201,
    'created track has id': (r) => typeof r.json().id === 'number',
    'created track has correct title': (r) => r.json().title.startsWith('Load Test Track'),
  });

  errorRate.add(!passed);
}

function fullCrudFlow() {
  // Create
  const createRes = http.post(
    `${BASE_URL}/api/tracks`,
    JSON.stringify({
      title: 'CRUD Test',
      artist: 'k6',
      bpm: 128,
      genre: 'Test',
      key: 'Cm',
      duration: 10,
      freq: 300,
      color: '#00ff00',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const createPassed = check(createRes, {
    'CRUD: create returns 201': (r) => r.status === 201,
  });

  if (!createPassed) {
    errorRate.add(true);
    return;
  }

  const id = createRes.json().id;

  // Read
  const readRes = http.get(`${BASE_URL}/api/tracks/${id}`);
  check(readRes, {
    'CRUD: read returns 200': (r) => r.status === 200,
    'CRUD: read returns correct track': (r) => r.json().title === 'CRUD Test',
  });

  // Update
  const updateRes = http.put(
    `${BASE_URL}/api/tracks/${id}`,
    JSON.stringify({ title: 'Updated CRUD Test' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(updateRes, {
    'CRUD: update returns 200': (r) => r.status === 200,
    'CRUD: title was updated': (r) => r.json().title === 'Updated CRUD Test',
  });

  // Delete
  const deleteRes = http.del(`${BASE_URL}/api/tracks/${id}`);
  check(deleteRes, {
    'CRUD: delete returns 204': (r) => r.status === 204,
  });

  // Verify deleted
  const verifyRes = http.get(`${BASE_URL}/api/tracks/${id}`);
  const passed = check(verifyRes, {
    'CRUD: deleted track returns 404': (r) => r.status === 404,
  });

  errorRate.add(!passed);
}

// ── Setup: reset server state ───────────────────────────────────────────────

export function setup() {
  const res = http.post(`${BASE_URL}/api/tracks/reset`);
  check(res, {
    'setup: reset returns 204': (r) => r.status === 204,
  });
}

// ── Teardown: reset after test ──────────────────────────────────────────────

export function teardown() {
  http.post(`${BASE_URL}/api/tracks/reset`);
}
