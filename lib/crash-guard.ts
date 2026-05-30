/**
 * Logs uncaught JS errors locally and reports them to Koko Bay `/api/app/error-log`.
 */
import { reportAppErrorFromUnknown } from '@/lib/appErrorLog';

export function installJsCrashGuard(): void {
  const errorUtils = (global as {
    ErrorUtils?: {
      getGlobalHandler?: () => (e: unknown, fatal?: boolean) => void;
      setGlobalHandler?: (h: (e: unknown, fatal?: boolean) => void) => void;
    };
  }).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) {
    return;
  }

  const previous = errorUtils.getGlobalHandler();

  errorUtils.setGlobalHandler((error, isFatal) => {
    reportAppErrorFromUnknown(error, {
      fatal: Boolean(isFatal),
      context: { source: 'global_error_handler' },
    });

    previous?.(error, isFatal);
  });
}
