import { create } from 'zustand';

import { recordHydration } from '@/lib/lifecycle-perf';

import { loadSearchHistory, persistSearchHistory } from './search-history-persist';

const MAX_ENTRIES = 14;

type SearchHistoryState = {
  entries: string[];
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  /** Dedupes case-insensitively, most recent first */
  addEntry: (query: string) => void;
  removeEntry: (query: string) => void;
  clear: () => void;
};

function normalizeEntry(q: string): string {
  return q.trim().replace(/\s+/g, ' ');
}

export const useSearchHistoryStore = create<SearchHistoryState>((set, get) => ({
  entries: [],
  hasHydrated: false,

  hydrate: async () => {
    if (__DEV__) recordHydration('searchHistory', get().hasHydrated);
    if (get().hasHydrated) return;
    const loaded = await loadSearchHistory();
    set({ entries: loaded, hasHydrated: true });
  },

  addEntry: (query) => {
    const t = normalizeEntry(query);
    if (t.length < 1) return;
    set((s) => {
      const lower = t.toLowerCase();
      const filtered = s.entries.filter((e) => e.toLowerCase() !== lower);
      const next = [t, ...filtered].slice(0, MAX_ENTRIES);
      return { entries: next };
    });
  },

  removeEntry: (query) => {
    const lower = normalizeEntry(query).toLowerCase();
    set((s) => ({
      entries: s.entries.filter((e) => e.toLowerCase() !== lower),
    }));
  },

  clear: () => set({ entries: [] }),
}));

useSearchHistoryStore.subscribe((state, prev) => {
  if (!state.hasHydrated) return;
  if (state.entries === prev.entries) return;
  void persistSearchHistory(state.entries);
});
