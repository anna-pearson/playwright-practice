# Bug Report: X-Powered-By Header Exposes Server Framework

| Field         | Value                                    |
|---------------|------------------------------------------|
| **ID**        | SEC-001                                  |
| **Severity**  | Medium                                   |
| **Priority**  | P2                                       |
| **Status**    | Open                                     |
| **Reporter**  | Anna Pearson                             |
| **Date**      | 2026-05-21                               |
| **Component** | API / Express Server                     |
| **Found by**  | Automated security test (security.spec.ts:351) |

## Summary

The API returns an `X-Powered-By: Express` header on every response, revealing the backend framework to any client. This is an information disclosure vulnerability — attackers can use it to identify and target known Express.js CVEs.

## Steps to Reproduce

1. Send any request to the API (e.g., `GET /api/tracks`)
2. Inspect the response headers

## Expected Behavior

The `X-Powered-By` header should not be present. Server technology should not be disclosed in response headers.

## Actual Behavior

Every API response includes:
```
X-Powered-By: Express
```

## Evidence

```bash
$ curl -I http://localhost:4173/api/tracks

HTTP/1.1 200 OK
X-Powered-By: Express          <── information leak
Content-Type: application/json; charset=utf-8
```

Captured by automated test:
```
tests/security.spec.ts:351 › Response security headers › API does not expose server version
  SECURITY FINDING: X-Powered-By header exposed: "Express"
```

## Impact

- **Information disclosure**: Reveals the server is running Express.js
- **Attack surface**: Allows targeted exploit research against known Express vulnerabilities
- **OWASP reference**: A05:2021 — Security Misconfiguration

## Recommended Fix

Add one line to `server.js`, before any route definitions:

```javascript
app.disable('x-powered-by');
```

This is a one-line fix with no functional impact. Express enables this header by default; it must be explicitly disabled.

## Risk Assessment

| Factor              | Rating  |
|---------------------|---------|
| Exploitability      | Low — requires additional vulnerabilities to chain |
| Impact if exploited | Medium — aids reconnaissance for targeted attacks  |
| Fix complexity      | Trivial — single line of code                      |
| Regression risk     | None — no functionality depends on this header     |
