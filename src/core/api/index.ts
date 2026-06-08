export { api, ApiClient, registerApiAnalyticsListener } from './apiClient';
export {
  legacyApiErrorStatus,
  legacyApiFetch,
  legacyApiGetOptional,
  legacyApiPostFireAndForget,
  type LegacyApiOptions,
  type LegacyHttpResult,
} from './legacy-fetch-adapter';
export { getApiAuthLifecycle, registerApiAuthLifecycle } from './auth-lifecycle';
export {
  buildApiUrl,
  buildRequestAuthHeaders,
  resolveApiBaseUrl,
  shouldAttemptAuthRefresh,
} from './authInterceptor';
export { extractSessionTokenFromResponse } from './session-token';
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
} from './errorHandler';
export { requestQueue, RequestQueue } from './requestQueue';
export * from './schemas';
export type {
  ApiAnalyticsEvent,
  ApiAuthLifecycle,
  ApiAuthMode,
  ApiErrorKind,
  ApiHttpMethod,
  ApiRequestOptions,
  ApiSuccessResponse,
} from './types';
