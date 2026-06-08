# Cart pending operation recovery

Pending cart mutations are **not** persisted as a command queue. Recovery after app crash or kill relies on:

1. **`cartRevision` vs `lastSyncedRevision`** — persisted lines load on hydrate; if the bag differs from Shopify, `isCartDirty()` is true.
2. **Hydrate refresh** — `scheduleSync('hydrate*')` runs with `server_authoritative` reconciliation when persisted lines need remote validation (missing line ids, checkout refresh, etc.).
3. **Foreground resume** — debounced sync arms with `server_authoritative` when the app returns active.
4. **Sync watchdog** — stuck `pendingCartSync` / `isSyncingShopify` (>10s) triggers an authoritative `flushCartSync`.
5. **Checkout gate** — checkout cannot open until `cartRevision === lastSyncedRevision` and sync flags are clear.

Optimistic local lines remain in SecureStore until the next successful authoritative sync. No separate pending-op queue is required for the current revision + hydrate model.
