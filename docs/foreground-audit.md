# Foreground resume audit

Dev-only instrumentation for sluggish UI after returning from background. **Does not change app behaviour** — logging only.

## Enable

1. Add to `.env`:
   ```
   EXPO_PUBLIC_FOREGROUND_AUDIT=1
   ```
2. Restart Metro (`pnpm start`) — Expo reads `EXPO_PUBLIC_*` at bundle time.
3. Background the app (or open app switcher), then return to foreground.
4. Filter Metro logs with `[FOREGROUND]`.

Optional: combine with `EXPO_PUBLIC_RENDER_TRACE=1` for per-render `[RENDER]` lines (foreground audit counts renders even without this flag).

## Audit window

Each **inactive/background → active** transition starts a **15 second** window. After 15s, a single `[FOREGROUND_SUMMARY]` is emitted.

## Log prefixes

| Prefix | What it tracks |
|--------|----------------|
| `[FOREGROUND]` | AppState active, transition, JS thread responsiveness |
| `[FOREGROUND_NETWORK]` | Every `fetch` during the window (via `fetchWithTimeout`) |
| `[FOREGROUND_NETWORK_TOTALS]` | Grouped totals by source at end of window |
| `[FOREGROUND_QUERY]` | React Query refetches (key, duration, reason) |
| `[STORE_UPDATE]` | Zustand + wishlist context updates (`changedKeys`) |
| `[CART_RESUME]` | Cart sync scheduler / fast paths / foreground resume |
| `[FOREGROUND_RENDER_SUMMARY]` | Render counts per tracked component |
| `[FOREGROUND_TIMERS]` | Active timer baseline vs after 15s + new timers created |
| `[FOREGROUND_SUMMARY]` | Full rollup + top offenders |

## Network sources

Requests are grouped into: `cart`, `wishlist`, `promotions`, `products`, `collections`, `auth`, `search`, `other` (URL heuristics in `lib/foreground-audit/network-source.ts`).

## Rendered components

- Home, Collection, Product, Cart, CheckoutBar, BottomTabs, Header, ProductCard

## Stores watched

- `cart`, `auth`, `market`, `search` (search history), `wishlist` (context)

Promotions are tracked via React Query refetches (keys containing `promotion` / invalidations from banner sync).

## JS responsiveness

On resume:

- `first_timer_delay` — `setTimeout(0)` delay (JS thread queue depth)
- `interactions_complete` — `InteractionManager.runAfterInteractions` delay

`js_block_ms` in the summary uses `interactions_complete` when available, else `first_timer_delay`.

## Files

- `lib/foreground-audit/` — audit state, network classification, store watchers
- `components/providers/foreground-audit-sync.tsx` — AppState listener + 15s summary timer
- `utils/fetch-with-timeout.ts` — network duration logging
- `lib/resume-query-observer.ts` — query refetch logging
- `lib/render-trace.ts`, `hooks/use-lifecycle-render-count.ts`, `hooks/use-product-card-render-trace.ts` — render counts
- `store/cart.ts`, `store/cart-sync-scheduler.ts`, `lib/cart-sync-trace.ts`, `lib/cart-perf-log.ts` — cart sync audit

## Related

- `[JS_FREEZE]` / `[FREEZE_REPORT]` — JS thread freeze detection (`docs/js-freeze-audit.md`)
- `[lifecycle]` / `[resume]` — existing lifecycle profiler (`LifecyclePerfSync`, `ResumePerfSync`)
- See `docs/lifecycle-perf-audit.md`
