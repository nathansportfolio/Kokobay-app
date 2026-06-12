import { Redirect, useLocalSearchParams } from 'expo-router';

/** Universal link entry — `/search?q=…` → tabbed search PLP. */
export default function SearchDeepLinkScreen() {
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const raw = params.q;
  const q = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';

  if (q?.trim()) {
    return <Redirect href={{ pathname: '/search', params: { q: q.trim() } }} />;
  }

  return <Redirect href="/search-overlay" />;
}
