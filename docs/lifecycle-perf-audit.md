# App lifecycle performance audit

Dev-only instrumentation — filter Metro logs with `[lifecycle]`.

## Enable

Runs automatically in `__DEV__` via `LifecyclePerfSync` in `AppProviders`.

## Dashboard

Every 15s, on background, on foreground, and 30s after foreground:

```
[lifecycle] dashboard { ... }
[lifecycle] snapshot:foreground { activeListeners, activeTimers, ... }
```

## What runs on resume (expected)

| Operation | Listeners | Typical count |
|-----------|-----------|---------------|
| Promotion banner invalidate | `app-promotion-banner-sync` | 1 |
| Resume perf marks | `resume-perf-sync` | 1 |
| Incident banner (if env on) | `app-error-banner-sync` | 0–1 |
| Cart sync scheduler | `cart-sync-scheduler` | 1 (after first cart edit) |
| React Query refetches | via `[resume]` logs | varies |

Hydration (`auth`, `cart`, `market`, `searchHistory`) runs **once** at cold start — `recordHydration(..., skipped: true)` on resume if already hydrated.

## Known duplicate risks

- **Cart** uses a single `cart-sync-scheduler` AppState listener and debounce queue (full + fast paths share it).
- **Frozen tab screens** (`freezeOnBlur: false`) keep mounted — render counts climb on resume from query/store updates, not necessarily leaks.

## Memory

`performance.memory` is often unavailable on React Native/Hermes — dashboard shows `n/a`. Samples still logged with phase labels.

## Foreground summary (`[resume] foreground_summary`)

Logged ~8s after each background/inactive → active transition:

| Field | Meaning |
|-------|---------|
| `foreground_duration_ms` | Wall time from foreground baseline to summary |
| `network_requests_on_foreground` | `fetch` calls tagged `app_foreground` |
| `js_interactions_idle_ms` | Time until `InteractionManager.runAfterInteractions` |
| `tracked_handler_work_ms` | Sum of resume perf marks |
| `render_count_delta` | Per-screen render count change (`use-lifecycle-render-count`) |
| `active_timers_delta` | Net timers still scheduled vs baseline |

## Files

- `lib/lifecycle-perf/` — registry, timer patch, snapshot
- `components/providers/lifecycle-perf-sync.tsx` — dashboard + memory samples
- `hooks/use-lifecycle-render-count.ts` — screen render counts
- `utils/fetch-with-timeout.ts` — network tracking
