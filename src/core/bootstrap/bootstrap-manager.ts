import { InteractionManager } from 'react-native';

import { probeKlaviyoOnAppStart } from '@/lib/klaviyo/client';
import { cartEngine } from '@/src/core/cart';
import { initializeFirebaseAnalytics } from '@/src/lib/firebase';
import { initializeFirebaseCrashlytics } from '@/src/lib/firebase-crashlytics';
import { LOCALE_CURRENCY_TOAST } from '@/services/shopify/initialize-currency-from-locale';
import { useAuthStore } from '@/store/auth-session';
import { useMarketStore } from '@/store/market-preference';
import { useSearchHistoryStore } from '@/store/search-history';
import { showToast } from '@/store/toast';

import type { BootstrapPhase } from './types';
import { isBootstrapPhaseAtLeast } from './types';

type BootstrapListener = (phase: BootstrapPhase) => void;

/** Delay before Phase C so the first home frame can paint after Phase B. */
const PHASE_C_DEFER_MS = 400;

class BootstrapManager {
  private phase: BootstrapPhase = 'idle';
  private readonly listeners = new Set<BootstrapListener>();
  private phaseAPromise: Promise<void> | null = null;
  private afterRevealStarted = false;
  private phaseBPromise: Promise<void> | null = null;
  private phaseCPromise: Promise<void> | null = null;

  getPhase(): BootstrapPhase {
    return this.phase;
  }

  isAtLeast(minimum: BootstrapPhase): boolean {
    return isBootstrapPhaseAtLeast(this.phase, minimum);
  }

  subscribe(listener: BootstrapListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setPhase(next: BootstrapPhase): void {
    if (this.phase === next) return;
    this.phase = next;
    if (__DEV__) {
      console.log(`[BOOTSTRAP] phase=${next}`);
    }
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  /**
   * Phase A — blocks first paint.
   * Restore auth session only.
   */
  async runPhaseA(): Promise<void> {
    if (this.phaseAPromise) return this.phaseAPromise;

    this.phaseAPromise = (async () => {
      this.setPhase('A');
      await useAuthStore.getState().hydrate();
      this.setPhase('B');
    })();

    return this.phaseAPromise;
  }

  /**
   * Phase B + C — call once after the splash reveals the main navigator.
   * User can interact during Phase B; Phase C is deferred.
   */
  continueAfterReveal(): void {
    if (this.afterRevealStarted) return;
    this.afterRevealStarted = true;
    void this.runPhaseB().then(() => this.runPhaseC());
  }

  private runPhaseB(): Promise<void> {
    if (this.phaseBPromise) return this.phaseBPromise;

    this.phaseBPromise = (async () => {
      await Promise.all([
        useMarketStore.getState().hydrate(),
        cartEngine.hydrate(),
        useSearchHistoryStore.getState().hydrate(),
      ]);

      const pendingCurrencyToast = useMarketStore.getState().pendingLocaleCurrencyToast;
      if (pendingCurrencyToast) {
        showToast({ variant: 'info', title: LOCALE_CURRENCY_TOAST[pendingCurrencyToast] });
        useMarketStore.getState().clearPendingLocaleCurrencyToast();
      }

      const { schedulePostRevealWarmup } = await import('@/lib/app-launch');
      await schedulePostRevealWarmup();

      if (__DEV__) {
        console.log('[CART_STATE_TRANSITION] source=bootstrap:phase_b_done');
      }
    })();

    return this.phaseBPromise;
  }

  private runPhaseC(): Promise<void> {
    if (this.phaseCPromise) return this.phaseCPromise;

    this.phaseCPromise = (async () => {
      this.setPhase('C');

      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          setTimeout(resolve, PHASE_C_DEFER_MS);
        });
      });

      await Promise.all([initializeFirebaseAnalytics(), initializeFirebaseCrashlytics()]);

      probeKlaviyoOnAppStart();

      this.setPhase('complete');
    })();

    return this.phaseCPromise;
  }

  /** Test helper — reset singleton state. */
  reset(): void {
    this.phase = 'idle';
    this.phaseAPromise = null;
    this.afterRevealStarted = false;
    this.phaseBPromise = null;
    this.phaseCPromise = null;
    this.listeners.clear();
  }
}

export const bootstrapManager = new BootstrapManager();
