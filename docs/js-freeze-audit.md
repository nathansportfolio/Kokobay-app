# JS thread freeze audit

Detects **JS execution blockage** after foreground resume — not network/API latency.

## Enable

Add to `.env` (either flag works; both can be set):

```
EXPO_PUBLIC_JS_FREEZE_AUDIT=1
# or
EXPO_PUBLIC_FOREGROUND_AUDIT=1
```

Restart Metro. Background the app, return to foreground, filter logs:

- `[JS_FREEZE]` — event loop lag spikes
- `[LONG_TASK]` — synchronous work >16ms
- `[RESUME_TIMELINE]` — ordered resume events
- `[RENDER_STORM]` — component rendered >20 times in 10s
- `[FREEZE_REPORT]` — 15s summary

## 1. Event loop lag monitor

Every **100ms** while active after resume:

```
expected = now + 100
lag_ms = performance.now() - expected
```

Logs `[JS_FREEZE] lag_ms=…` when lag **>100ms**, with bucket markers at 100 / 250 / 500 / 1000ms.

## 2. Long task monitor (>16ms)

Wrapped synchronously:

| Source | Task name |
|--------|-----------|
| Zustand | `zustand.setState:cart`, `auth`, `market`, `search` |
| React Query | `react-query.cache:updated`, etc. |
| Wishlist | `wishlist.setState`, `wishlist.setHydrated` |
| Promotions | `promotion.invalidate:app_state` |

Cart sync **timeline** marks (`cart_sync_start` / `cart_sync_end`) are separate — they measure wall time including awaits, not logged as long tasks.

## 3. Resume timeline

`[RESUME_TIMELINE] event=… ms_since_resume=…`

Events: `resume_start`, `query_refetch_start`, `query_refetch_end`, `store_update`, `cart_sync_start`, `cart_sync_end`, `render_complete`

## 4. Render storm (first 10s)

Tracks: ProductCard, Home, Product, Cart, CheckoutBar, BottomTabs

Logs `[RENDER_STORM]` when any exceeds **20 renders**.

When ProductCard storms, also emits `[PRODUCT_CARD_STORM_REPORT]` (see ProductCard diff below).

## 5. Final report (15s)

`[FREEZE_REPORT]` includes:

- `max_event_loop_lag_ms`
- `total_long_tasks`
- `slowest_task`
- `most_rendered_component`
- `total_renders`
- `largest_store_update`
- full `timeline`

## Files

- `lib/js-freeze-audit/` — core
- `components/providers/js-freeze-audit-sync.tsx` — AppState + event loop + report timer
- `lib/js-freeze-audit/instrument-zustand.ts` — patched at startup in `LifecyclePerfSync`
- See also `docs/foreground-audit.md`

## ProductCard rerender diff (optional)

Enable always-on diff logging:

```
EXPO_PUBLIC_PRODUCT_CARD_DIFF=1
```

Or rely on `EXPO_PUBLIC_JS_FREEZE_AUDIT=1` / `EXPO_PUBLIC_FOREGROUND_AUDIT=1` (traces only during the 15s resume window).

Metro filters:

| Prefix | Meaning |
|--------|---------|
| `[PRODUCT_CARD_DIFF]` | Prop/category changes per render (`query_data`, `navigation_state`, etc.) |
| `[PRODUCT_CARD_IDENTITY]` | `prev_product===next_product`, wishlist boolean equality |
| `[COLLECTION_RENDER]` | PLP list input reference changes |
| `[PRODUCT_CARD_DATA_SOURCE]` | React Query / products array / flat items / wishlist map |
| `[PRODUCT_CARD_STORM_REPORT]` | Summary after 20+ renders or freeze report |

Files: `lib/product-card-storm-trace.ts`, `hooks/use-product-card-render-trace.ts`, `hooks/use-collection-plp-render-trace.ts`
