# Browser Runtime and Performance Lab

A dependency-light browser lab for observing how the DOM, event loop, network requests, client-side caching, Web Workers, rendering, and Web Vitals interact.

The project favors visible experiments over framework abstractions so each browser behavior can be inspected directly in DevTools.

## What it demonstrates

- DOM updates and event callbacks on the main thread
- Asynchronous network requests with `fetch()`
- Long tasks and their effect on responsiveness
- Moving CPU-intensive work to a Web Worker
- A small query cache with fresh, stale, inactive, and garbage-collected states
- Mutation-driven cache invalidation and active-query refetching
- LCP, INP, CLS, navigation timing, and long-task observation
- Sending browser telemetry to a local HTTP endpoint

## Architecture

```text
Browser UI
  ├─ DOM events and rendering
  ├─ in-memory query cache
  ├─ Web Worker
  └─ performance observers
          │
          ▼
Local Node.js HTTP server
  ├─ static assets
  ├─ reservation API
  └─ telemetry API
```

## Run locally

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:4173>.

Useful endpoints:

```bash
curl -i http://127.0.0.1:4173/api/health
curl -s http://127.0.0.1:4173/api/reservations
curl -i 'http://127.0.0.1:4173/api/reservations?fail=true'
curl -s http://127.0.0.1:4173/api/telemetry
```

## Experiments

### Main thread versus Web Worker

1. Start the live clock.
2. Run **Block main thread 3s** and observe the stalled interface.
3. Run **Run in Web Worker 3s** and observe the clock continuing to update.
4. Record both flows in Chrome Performance and compare the main-thread timeline.

### Query-cache lifecycle

1. Clear the cache and load reservations to observe a cache miss.
2. Load again within ten seconds to observe a fresh cache hit without a network request.
3. Wait for the entry to become stale and observe the next request refetching data.
4. Unmount the reservation view and observe garbage collection of the inactive entry.
5. Create a reservation and observe mutation-driven invalidation followed by an active refetch.

The current cache is available in DevTools:

```js
browserLab.queryCache
browserLab.queryCache.get("reservations")
```

### Browser performance

- Use **Block main thread 3s** to increase interaction latency and long-task duration.
- Use **Reload with slow LCP** to delay the main content.
- Use **Create layout shift** to produce a measurable CLS change.
- Use **Send telemetry** and inspect the captured payload through `/api/telemetry`.

## Scope

This is an educational, local-only environment. It intentionally implements a small cache rather than replacing a production query library and should not be treated as a production telemetry service.
