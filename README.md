# ⚡ StrataProxy

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](./tsconfig.json)
[![Dependencies](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](./package.json)

A zero-dependency Layer 7 reverse proxy and API gateway, built from scratch in Node.js and strict TypeScript as a learning project. It provides load balancing, caching, request coalescing and rate limiting using only `node:http` and `node:stream`, with no Express or http-proxy-middleware.

## ✨ Key Features

- **Round-robin load balancing:** active `/health` probes, with hysteresis to prevent flapping (3 failures to eject a server, 2 successes to reinstate it).
- **O(1) LRU cache:** a custom doubly linked list plus `Map`, with TTL expiry and a 1 MB payload ceiling.
- **Anti-stampede coalescer:** concurrent identical `GET` requests share a single upstream fetch.
- **Sliding-window rate limiter:** a per-IP circular ring buffer that returns `429` with a `Retry-After` header.
- **Header sanitization:** strips RFC 7230 hop-by-hop headers and injects `X-Forwarded-For/Proto/Host`.
- **Streaming and socket pooling:** `stream.pipeline` forwarding over a keep-alive `http.Agent`.

## 🏗 Architecture

```
Client ──▶ RateLimiter ──(over limit)──────────────────────────────▶ 429
               │
               ▼
          GET? ──no──────────────────────────────────┐
               │ yes                                 │
               ▼                                     │
           LruCache ──(HIT)──────────────────────────┼─────────────▶ Client
               │ MISS                                │
               ▼                                     │
           Coalescer ──(already in flight: share)────┼─────────────▶ Client
               │ leader                              │
               ▼                                     ▼
        UpstreamPool (round-robin) ──(none healthy)────────────────▶ 503
               │
               ▼
        StreamPipe (sanitize headers ─▶ keep-alive Agent ─▶ pipe)
               │
       ┌───────┴───────┐        ◀── HealthChecker: GET /health every 5s
       ▼               ▼
  Upstream :4001  Upstream :4002
```

## 📂 Project Structure

```
l7-reverse-proxy/
├── src/
│   ├── server.ts              # Gateway entry: request pipeline & graceful shutdown
│   ├── config.ts              # Port, upstreams, cache, rate limit & health check settings
│   ├── balancer/
│   │   ├── UpstreamPool.ts    # Round-robin selection over healthy upstreams
│   │   └── HealthChecker.ts   # Periodic probes with failure/success thresholds
│   ├── cache/
│   │   ├── DoublyLinkedList.ts
│   │   ├── LruCache.ts        # O(1) LRU with TTL & size ceiling
│   │   └── Coalescer.ts       # In-flight request deduplication
│   ├── limiter/
│   │   ├── RingBuffer.ts
│   │   └── RateLimiter.ts     # Per-IP sliding window
│   └── proxy/
│       ├── HeaderParser.ts    # Hop-by-hop stripping & X-Forwarded-* headers
│       └── StreamPipe.ts      # Agent pooling & response streaming
├── test-servers/              # Mock upstreams on :4001 and :4002
├── tests/                     # Unit suites + test-final.ts E2E suite
├── package.json
└── tsconfig.json
```

**Defaults** (`src/config.ts`):
- Gateway: `127.0.0.1:8080`
- Cache: 100 items, 1 MB max body, 60 s TTL
- Rate limit: 10 requests per 10 s per IP
- Health checks: every 5 s with a 2 s timeout

## 🚀 Quick Start

```bash
npm install                 # dev tooling only (typescript, tsx, @types/node)

npm run dev:upstreamA       # terminal 1 → http://127.0.0.1:4001
npm run dev:upstreamB       # terminal 2 → http://127.0.0.1:4002
npm run dev:proxy           # terminal 3 → http://127.0.0.1:8080
```

```bash
curl -i http://127.0.0.1:8080/cache-test   # run twice → X-cache: HIT
```

For a production build, run `npm run build && npm start`.

## 🧪 Testing

```bash
# Unit tests
npx tsx tests/test-balancer.ts
npx tsx tests/test-cache.ts
npx tsx tests/test-limiter.ts

# End-to-end: starts both upstreams and the gateway, then checks load balancing,
# caching and rate limiting. Ports 4001, 4002 and 8080 must be free.
npx tsx tests/test-final.ts
```

