export type GtmConfig = {
  /** GTM container id, e.g. GTM-XXXXXXX */
  containerId: string | null;
  /** Server-side GTM / collect endpoint — required for the live receiver. */
  endpoint: string | null;
  /** When true, events are also sent to the mock receiver for local inspection. */
  debug: boolean;
};

function readEnv(key: string): string | null {
  const value = process.env[key]?.trim();
  return value || null;
}

export function getGtmConfig(): GtmConfig {
  return {
    containerId: readEnv('EXPO_PUBLIC_GTM_CONTAINER_ID'),
    endpoint: readEnv('EXPO_PUBLIC_GTM_ENDPOINT'),
    debug: readEnv('EXPO_PUBLIC_GTM_DEBUG') === '1' || __DEV__,
  };
}

export function isGtmLiveConfigured(config: GtmConfig = getGtmConfig()): boolean {
  return Boolean(config.containerId && config.endpoint);
}
