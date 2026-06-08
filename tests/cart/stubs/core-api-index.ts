export { api, ApiClient, registerApiAnalyticsListener } from './api-client';
export {
  legacyApiErrorStatus,
  legacyApiFetch,
  legacyApiGetOptional,
  legacyApiPostFireAndForget,
  type LegacyApiOptions,
  type LegacyHttpResult,
} from '@/src/core/api/legacy-fetch-adapter';
export { getApiAuthLifecycle, registerApiAuthLifecycle } from '@/src/core/api/auth-lifecycle';
export {
  buildApiUrl,
  buildRequestAuthHeaders,
  resolveApiBaseUrl,
  shouldAttemptAuthRefresh,
} from '@/src/core/api/authInterceptor';
export { extractSessionTokenFromResponse } from '@/src/core/api/session-token';
export {
  commitInvalidCustomerSession,
  commitRefreshedCustomerSession,
  refreshAuthSession,
  refreshCustomerSession,
  type RefreshCustomerSessionResult,
} from '@/src/core/auth/refresh-customer-session';
export {
  ApiError,
  apiErrorFromConfiguration,
  apiErrorFromHttpResponse,
  apiErrorFromUnknown,
  apiErrorFromValidation,
  isApiError,
  isAuthExpiredError,
  isRetryableApiError,
  legacyApiErrorBody,
  legacyTransportReason,
} from '@/src/core/api/errorHandler';
export { requestQueue, RequestQueue } from '@/src/core/api/requestQueue';
export * from '@/src/core/api/schemas';
export type {
  ApiAnalyticsEvent,
  ApiAuthLifecycle,
  ApiAuthMode,
  ApiErrorKind,
  ApiHttpMethod,
  ApiRequestOptions,
  ApiSuccessResponse,
} from '@/src/core/api/types';
