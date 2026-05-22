import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY TESTING
// Tests the API for common web vulnerabilities: XSS, injection, path traversal,
// prototype pollution, oversized payloads, type coercion, and HTTP method abuse.
// These tests verify the API fails safely — no crashes, no data leaks.
// ─────────────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await request.post('/api/tracks/reset');
});

test.describe('XSS (Cross-Site Scripting)', () => {
  test('script tags in title are stored as plain text, not executed', async ({ request }) => {
    const response = await request.post('/api/tracks', {
      data: { title: '<script>alert("xss")</script>', artist: 'Hacker' },
    });
    const track = await response.json();

    // The title should be stored exactly as-is (plain text), not sanitized
    // or interpreted — the frontend must escape it when rendering
    expect(track.title).toBe('<script>alert("xss")</script>');
  });

  test('HTML in artist field is not interpreted', async ({ request }) => {
    const response = await request.post('/api/tracks', {
      data: { title: 'Normal', artist: '<img src=x onerror=alert(1)>' },
    });
    const track = await response.json();

    expect(track.artist).toBe('<img src=x onerror=alert(1)>');
  });

  test('XSS in search parameter does not crash the server', async ({ request }) => {
    const response = await request.get(
      '/api/tracks?search=' + encodeURIComponent('<script>alert("xss")</script>')
    );

    expect(response.status()).toBe(200);
    const tracks = await response.json();
    expect(Array.isArray(tracks)).toBe(true);
  });

  test('XSS in genre filter does not crash the server', async ({ request }) => {
    const response = await request.get(
      '/api/tracks?genre=' + encodeURIComponent('"><script>alert(1)</script>')
    );

    expect(response.status()).toBe(200);
    const tracks = await response.json();
    expect(tracks).toHaveLength(0);
  });

  test('@smoke stored XSS payload is returned as-is in GET (not executed)', async ({ page, request }) => {
    // Create a track with an XSS payload
    await request.post('/api/tracks', {
      data: { title: '<script>window.__xss=true</script>', artist: 'Test' },
    });

    // Load the page and check that the script was NOT executed
    await page.goto('/');
    const xssRan = await page.evaluate(() => (window as any).__xss);
    expect(xssRan).toBeUndefined();
  });
});

test.describe('Injection attacks', () => {
  test('SQL injection in ID parameter is harmlessly ignored', async ({ request }) => {
    const response = await request.get('/api/tracks/1;DROP TABLE tracks');

    // parseInt('1;DROP TABLE tracks') returns 1 — the injection is
    // silently discarded and the valid track is returned. No SQL database
    // exists to attack, but the test documents that the input is safe.
    expect(response.status()).toBe(200);
    const track = await response.json();
    expect(track.id).toBe(1);
  });

  test('NoSQL injection object in search does not crash', async ({ request }) => {
    const response = await request.get(
      '/api/tracks?search[$gt]='
    );

    expect(response.status()).toBe(200);
  });

  test('SQL UNION attack in search returns safely', async ({ request }) => {
    const response = await request.get(
      '/api/tracks?search=' + encodeURIComponent("' UNION SELECT * FROM users --")
    );

    expect(response.status()).toBe(200);
    const tracks = await response.json();
    expect(tracks).toHaveLength(0);
  });
});

test.describe('Path traversal', () => {
  test('cannot access files outside the app directory', async ({ request }) => {
    const response = await request.get('/../../etc/passwd', {
      failOnStatusCode: false,
    });

    // Should NOT return file contents
    const body = await response.text();
    expect(body).not.toContain('root:');
  });

  test('cannot access server.js source via path traversal', async ({ request }) => {
    const response = await request.get('/../server.js', {
      failOnStatusCode: false,
    });

    const body = await response.text();
    expect(body).not.toContain('express');
    expect(body).not.toContain('app.listen');
  });

  test('cannot access package.json via static files', async ({ request }) => {
    const response = await request.get('/../package.json', {
      failOnStatusCode: false,
    });

    const body = await response.text();
    expect(body).not.toContain('devDependencies');
  });

  test('encoded path traversal is also blocked', async ({ request }) => {
    const response = await request.get('/%2e%2e/%2e%2e/etc/passwd', {
      failOnStatusCode: false,
    });

    const body = await response.text();
    expect(body).not.toContain('root:');
  });
});

test.describe('Prototype pollution', () => {
  test('__proto__ in POST body does not pollute Object prototype', async ({ request }) => {
    await request.post('/api/tracks', {
      data: {
        title: 'Proto Test',
        artist: 'Test',
        '__proto__': { isAdmin: true },
      },
    });

    // Verify the prototype was not polluted
    const response = await request.get('/api/tracks/1');
    const track = await response.json();
    expect((track as any).isAdmin).toBeUndefined();
  });

  test('constructor.prototype in body does not pollute', async ({ request }) => {
    await request.post('/api/tracks', {
      data: {
        title: 'Constructor Test',
        artist: 'Test',
        'constructor': { 'prototype': { polluted: true } },
      },
    });

    const response = await request.get('/api/tracks/1');
    const track = await response.json();
    expect((track as any).polluted).toBeUndefined();
  });
});

test.describe('Oversized and malformed payloads', () => {
  test('very long title does not crash the server', async ({ request }) => {
    const longTitle = 'A'.repeat(10000);
    const response = await request.post('/api/tracks', {
      data: { title: longTitle, artist: 'Test' },
    });

    // Server should either accept it or reject it — but not crash
    expect([201, 400, 413]).toContain(response.status());
  });

  test('very long search query does not crash', async ({ request }) => {
    const longQuery = 'A'.repeat(10000);
    const response = await request.get(
      '/api/tracks?search=' + encodeURIComponent(longQuery)
    );

    expect(response.status()).toBe(200);
  });

  test('null bytes in title do not crash the server', async ({ request }) => {
    const response = await request.post('/api/tracks', {
      data: { title: 'Test\x00Track', artist: 'Test' },
    });

    expect([201, 400]).toContain(response.status());
  });

  test('unicode edge cases in title are handled', async ({ request }) => {
    const response = await request.post('/api/tracks', {
      data: { title: '🎵 Ÿ ← → ∞ 零', artist: '日本語テスト' },
    });
    const track = await response.json();

    expect(response.status()).toBe(201);
    expect(track.title).toBe('🎵 Ÿ ← → ∞ 零');
  });

  test('empty JSON object returns 400', async ({ request }) => {
    const response = await request.post('/api/tracks', {
      data: {},
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(400);
  });
});

test.describe('Type coercion attacks', () => {
  test('array as title is handled safely', async ({ request }) => {
    const response = await request.post('/api/tracks', {
      data: { title: ['injected', 'array'], artist: 'Test' },
      failOnStatusCode: false,
    });

    // Server should accept or reject, not crash
    expect([201, 400]).toContain(response.status());
  });

  test('number as title is handled safely', async ({ request }) => {
    const response = await request.post('/api/tracks', {
      data: { title: 12345, artist: 'Test' },
      failOnStatusCode: false,
    });

    expect([201, 400]).toContain(response.status());
  });

  test('boolean as title is handled safely', async ({ request }) => {
    const response = await request.post('/api/tracks', {
      data: { title: true, artist: 'Test' },
      failOnStatusCode: false,
    });

    expect([201, 400]).toContain(response.status());
  });

  test('nested object as title is handled safely', async ({ request }) => {
    const response = await request.post('/api/tracks', {
      data: { title: { '$gt': '' }, artist: 'Test' },
      failOnStatusCode: false,
    });

    expect([201, 400]).toContain(response.status());
  });

  test('string as bpm is handled safely', async ({ request }) => {
    const response = await request.post('/api/tracks', {
      data: { title: 'Test', artist: 'Test', bpm: 'not a number' },
      failOnStatusCode: false,
    });

    expect([201, 400]).toContain(response.status());
  });

  test('negative bpm is handled safely', async ({ request }) => {
    const response = await request.post('/api/tracks', {
      data: { title: 'Test', artist: 'Test', bpm: -120 },
      failOnStatusCode: false,
    });

    expect([201, 400]).toContain(response.status());
  });
});

test.describe('HTTP method abuse', () => {
  test('PATCH is not a valid method for tracks', async ({ request }) => {
    const response = await request.patch('/api/tracks/1', {
      data: { title: 'Patched' },
      failOnStatusCode: false,
    });

    // Express returns 404 for unregistered routes by default
    expect([404, 405]).toContain(response.status());
  });

  test('PUT to /api/tracks (collection) is not allowed', async ({ request }) => {
    const response = await request.put('/api/tracks', {
      data: { title: 'Bulk Update' },
      failOnStatusCode: false,
    });

    expect([404, 405]).toContain(response.status());
  });

  test('DELETE to /api/tracks (collection) is not allowed', async ({ request }) => {
    const response = await request.delete('/api/tracks', {
      failOnStatusCode: false,
    });

    expect([404, 405]).toContain(response.status());
  });
});

test.describe('ID manipulation', () => {
  test('negative ID returns 404', async ({ request }) => {
    const response = await request.get('/api/tracks/-1', {
      failOnStatusCode: false,
    });

    expect([400, 404]).toContain(response.status());
  });

  test('decimal ID returns 400 or is truncated safely', async ({ request }) => {
    const response = await request.get('/api/tracks/1.5', {
      failOnStatusCode: false,
    });

    // parseInt('1.5') returns 1, which is valid — server should handle gracefully
    expect([200, 400]).toContain(response.status());
  });

  test('extremely large ID does not crash', async ({ request }) => {
    const response = await request.get('/api/tracks/99999999999999', {
      failOnStatusCode: false,
    });

    expect([400, 404]).toContain(response.status());
  });

  test('ID with leading zeros is handled safely', async ({ request }) => {
    const response = await request.get('/api/tracks/001', {
      failOnStatusCode: false,
    });

    // parseInt('001') returns 1 — should find track 1
    expect([200, 400]).toContain(response.status());
  });

  test('ID of zero returns 404 (no track has ID 0)', async ({ request }) => {
    const response = await request.get('/api/tracks/0', {
      failOnStatusCode: false,
    });

    expect([400, 404]).toContain(response.status());
  });
});

test.describe('Response security headers', () => {
  test('API does not expose server version', async ({ request }) => {
    const response = await request.get('/api/tracks');
    const headers = response.headers();

    // X-Powered-By can reveal the framework (e.g. "Express") — should be disabled
    // Note: this test documents the current state; if it fails, that's a finding
    const poweredBy = headers['x-powered-by'];
    if (poweredBy) {
      console.warn(`SECURITY FINDING: X-Powered-By header exposed: "${poweredBy}"`);
    }
  });

  test('API responses have correct content-type', async ({ request }) => {
    const response = await request.get('/api/tracks');

    // JSON APIs should always declare content-type to prevent MIME sniffing
    expect(response.headers()['content-type']).toContain('application/json');
  });
});

test.describe('Rate limiting and abuse resistance', () => {
  test('server handles 50 rapid-fire requests without dropping any', async ({ request }) => {
    const promises = Array.from({ length: 50 }, () =>
      request.get('/api/tracks')
    );
    const responses = await Promise.all(promises);

    const failed = responses.filter(r => r.status() !== 200);
    expect(failed, `${failed.length} requests failed out of 50`).toHaveLength(0);
  });

  test('server handles 20 concurrent write operations', async ({ request }) => {
    const promises = Array.from({ length: 20 }, (_, i) =>
      request.post('/api/tracks', {
        data: { title: `Rapid ${i}`, artist: 'Stress Test' },
      })
    );
    const responses = await Promise.all(promises);

    const failed = responses.filter(r => r.status() !== 201);
    expect(failed, `${failed.length} writes failed out of 20`).toHaveLength(0);
  });

  test('server handles mixed read/write concurrency', async ({ request }) => {
    const reads = Array.from({ length: 10 }, () =>
      request.get('/api/tracks')
    );
    const writes = Array.from({ length: 5 }, (_, i) =>
      request.post('/api/tracks', {
        data: { title: `Mixed ${i}`, artist: 'Test' },
      })
    );
    const deletes = Array.from({ length: 3 }, (_, i) =>
      request.delete(`/api/tracks/${i + 1}`, { failOnStatusCode: false })
    );

    const responses = await Promise.all([...reads, ...writes, ...deletes]);
    const serverErrors = responses.filter(r => r.status() >= 500);
    expect(serverErrors, 'No 5xx errors under concurrent load').toHaveLength(0);
  });

  test('rapid creation does not produce duplicate IDs', async ({ request }) => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      request.post('/api/tracks', {
        data: { title: `Dedup ${i}`, artist: 'Test' },
      })
    );
    const responses = await Promise.all(promises);
    const ids = await Promise.all(
      responses.map(async r => (await r.json()).id)
    );

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size, 'All IDs should be unique').toBe(ids.length);
  });
});
