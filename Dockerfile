# ── Stage 1: Install dependencies ────────────────────────
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: App server ─────────────────────────────────
FROM node:22-slim AS app
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js ./
COPY app/ ./app/
EXPOSE 4173
CMD ["node", "server.js"]

# ── Stage 3: Test runner ────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.59.1-noble AS tests
WORKDIR /tests
COPY --from=deps /app/node_modules ./node_modules
COPY package.json playwright.config.ts tsconfig.json ./
COPY tests/ ./tests/
# Sauce Demo tests hit an external site and are excluded from
# containerized runs (no control over third-party availability).
# Visual regression baselines are platform-specific (generated on
# darwin) so screenshot tests are also excluded in Docker.
CMD ["npx", "playwright", "test", "--project=chromium", "--ignore-snapshots", "--grep-invert", "sauce-demo"]
