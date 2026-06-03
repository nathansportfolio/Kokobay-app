export { isJsFreezeAuditEnabled } from '@/lib/js-freeze-audit/enabled';
export { instrumentZustandSetStateForJsFreeze } from '@/lib/js-freeze-audit/instrument-zustand';
export { traceLongTask, traceLongTaskAsync } from '@/lib/js-freeze-audit/long-task';
export {
  beginJsFreezeSession,
  finishJsFreezeReport,
  isJsFreezeSessionActive,
  JS_FREEZE_EVENT_LOOP_INTERVAL_MS,
  JS_FREEZE_LAG_BUCKETS_MS,
  JS_FREEZE_RENDER_STORM_THRESHOLD,
  JS_FREEZE_RENDER_STORM_WINDOW_MS,
  JS_FREEZE_REPORT_WINDOW_MS,
  markJsFreezeTimeline,
  recordJsFreezeLongTask,
  recordJsFreezeRender,
  recordJsFreezeStoreUpdate,
  stopJsFreezeSession,
} from '@/lib/js-freeze-audit/state';
export type {
  JsFreezeRenderStormLabel,
  LongTaskEntry,
  ResumeTimelineEvent,
  StoreUpdateEntry,
} from '@/lib/js-freeze-audit/types';
