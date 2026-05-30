export type ScreenLoadTraceEvent =
  | 'SCREEN_MOUNT'
  | 'QUERY_START'
  | 'FIRST_RENDER'
  | 'SKELETON_RENDER'
  | 'DATA_RECEIVED'
  | 'CONTENT_RENDER';

type TraceMeta = Record<string, unknown>;

export function resetScreenLoadTrace(_screen: string, _meta?: TraceMeta): void {}

export function logScreenLoadTrace(
  _screen: string,
  _event: ScreenLoadTraceEvent,
  _meta?: TraceMeta,
): void {}

export function logScreenLoadTraceOnce(
  _screen: string,
  _event: ScreenLoadTraceEvent,
  _dedupeKey: string,
  _meta?: TraceMeta,
): void {}

export function clearScreenLoadTrace(_screen: string): void {}
