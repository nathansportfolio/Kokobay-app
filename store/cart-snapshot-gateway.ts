import type { ShopifyCartSnapshot } from '@/services/shopify/cart';
import type { CartLine } from '@/types/cart';
import type { Money } from '@/types/shopify';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

import type { CartLineReconciliationMode } from './cart-line-utils';
import {
  compareSnapshotVersions,
  extractSnapshotVersion,
  validateCartSnapshot,
} from './cart-snapshot-validate';
import type { CartPricingAuditRevision } from '@/lib/cart-pricing-audit';

export type ApplyValidatedRemoteSnapshotResult =
  | 'applied'
  | 'rejected'
  | 'stale_rejected'
  | 'revision_mismatch';

export type ApplyValidatedRemoteSnapshotOptions = {
  reconciledLines?: CartLine[];
  reconciliationMode?: CartLineReconciliationMode;
  source: string;
  revisionAtStart?: number;
  syncGeneration?: number;
  activeSyncGeneration?: number;
  skipDivergenceHeal?: boolean;
};

type CartSnapshotGatewayDeps = {
  getRevisionSnapshot: () => CartPricingAuditRevision;
  commitRemoteSnapshot: (snapshot: ShopifyCartSnapshot, reconciledLines?: CartLine[]) => void;
  scheduleSnapshotRecovery: () => void;
  scheduleDivergenceHeal: () => void;
  readLocalLines: () => CartLine[];
  readLocalSubtotal: () => Money | null;
};

let gatewayDeps: CartSnapshotGatewayDeps | null = null;
let lastServerSnapshotVersion: string | number | null = null;

export function bindCartSnapshotGateway(deps: CartSnapshotGatewayDeps): void {
  gatewayDeps = deps;
}

export function resetCartSnapshotGatewayForTests(): void {
  lastServerSnapshotVersion = null;
}

export function getLastServerSnapshotVersionForTests(): string | number | null {
  return lastServerSnapshotVersion;
}

function requireGatewayDeps(): CartSnapshotGatewayDeps {
  if (!gatewayDeps) {
    throw new Error('Cart snapshot gateway is not bound');
  }
  return gatewayDeps;
}

export function detectCartDivergence(
  localLines: CartLine[],
  snapshot: ShopifyCartSnapshot,
  localSubtotal: Money | null,
): boolean {
  if (localLines.length !== snapshot.lines.length) return true;

  const localSubN = parseMoneyAmount(localSubtotal);
  const remoteSubN = parseMoneyAmount(snapshot.subtotal);
  if (
    localSubN != null &&
    remoteSubN != null &&
    Math.abs(localSubN - remoteSubN) > 0.02
  ) {
    return true;
  }

  const localKeys = new Set(localLines.map((line) => shopifyVariantKey(line.variantId)));
  const remoteKeys = new Set(
    snapshot.lines.map((line) => shopifyVariantKey(line.variantId)),
  );
  if (localKeys.size !== remoteKeys.size) return true;
  for (const key of localKeys) {
    if (!remoteKeys.has(key)) return true;
  }
  return false;
}

function parseMoneyAmount(m: Money | null | undefined): number | null {
  if (m?.amount == null || String(m.amount).trim() === '') return null;
  const value = Number.parseFloat(String(m.amount));
  return Number.isFinite(value) ? value : null;
}

/** Single entry point for applying remote Shopify / Koko Bay cart snapshots. */
export function applyValidatedRemoteSnapshot(
  snapshot: ShopifyCartSnapshot,
  options: ApplyValidatedRemoteSnapshotOptions,
): ApplyValidatedRemoteSnapshotResult {
  const deps = requireGatewayDeps();
  const validation = validateCartSnapshot(snapshot);
  if (!validation.ok) {
    console.log('[CART_SNAPSHOT_REJECTED]', {
      reason: validation.reason,
      source: options.source,
      cartId: snapshot.cartId,
      lineCount: snapshot.lines.length,
    });
    deps.scheduleSnapshotRecovery();
    logCartHealthStatus();
    return 'rejected';
  }

  const incomingVersion = extractSnapshotVersion(snapshot);
  if (incomingVersion != null && lastServerSnapshotVersion != null) {
    const order = compareSnapshotVersions(incomingVersion, lastServerSnapshotVersion);
    if (order === 'older') {
      console.log('[CART_STALE_SNAPSHOT_REJECTED]', {
        incomingVersion,
        lastServerSnapshotVersion,
        source: options.source,
        cartId: snapshot.cartId,
      });
      logCartHealthStatus();
      return 'stale_rejected';
    }
  }

  const revision = deps.getRevisionSnapshot();
  if (
    options.revisionAtStart != null &&
    options.revisionAtStart !== revision.cartRevision
  ) {
    return 'revision_mismatch';
  }
  if (
    options.syncGeneration != null &&
    options.activeSyncGeneration != null &&
    options.syncGeneration !== options.activeSyncGeneration
  ) {
    return 'revision_mismatch';
  }

  deps.commitRemoteSnapshot(snapshot, options.reconciledLines);

  if (incomingVersion != null) {
    lastServerSnapshotVersion = incomingVersion;
  }

  if (
    !options.skipDivergenceHeal &&
    options.reconciliationMode === 'optimistic' &&
    detectCartDivergence(deps.readLocalLines(), snapshot, deps.readLocalSubtotal())
  ) {
    console.log('[CART_DIVERGENCE_DETECTED]', {
      source: options.source,
      localLineCount: deps.readLocalLines().length,
      remoteLineCount: snapshot.lines.length,
      cartId: snapshot.cartId,
    });
    deps.scheduleDivergenceHeal();
  }

  logCartHealthStatus();
  return 'applied';
}

export function logCartHealthStatus(): void {
  const deps = gatewayDeps;
  if (!deps) return;

  const revision = deps.getRevisionSnapshot();
  const localLines = deps.readLocalLines();
  const localSubtotal = deps.readLocalSubtotal();
  const diverged = false; // post-apply health uses revision flags; divergence triggers heal separately

  const healthy =
    revision.cartRevision === revision.lastSyncedRevision &&
    revision.isCartDirty === false;

  const stateHealthy =
    healthy &&
    !readPendingCartSync() &&
    !readIsSyncingShopify();

  const payload = {
    cartRevision: revision.cartRevision,
    lastSyncedRevision: revision.lastSyncedRevision,
    pendingCartSync: readPendingCartSync(),
    isSyncingShopify: readIsSyncingShopify(),
    localLineCount: localLines.length,
    diverged,
  };

  if (stateHealthy && !diverged) {
    console.log('[CART_HEALTH_GOOD]', payload);
    return;
  }
  console.log('[CART_HEALTH_DEGRADED]', payload);
}

let readPendingCartSync = (): boolean => false;
let readIsSyncingShopify = (): boolean => false;

export function bindCartHealthReaders(readers: {
  readPendingCartSync: () => boolean;
  readIsSyncingShopify: () => boolean;
}): void {
  readPendingCartSync = readers.readPendingCartSync;
  readIsSyncingShopify = readers.readIsSyncingShopify;
}
