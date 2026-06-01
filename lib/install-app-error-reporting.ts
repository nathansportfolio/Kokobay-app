/**
 * Installs global hooks for important failures → Koko Bay `POST /api/app/error-log`.
 * Does not report console noise or routine operational failures.
 */
import { reportAppErrorFromUnknown } from '@/lib/appErrorLog';
import { installJsCrashGuard } from '@/lib/crash-guard';

function installUnhandledPromiseReporting(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tracking = require('promise/setimmediate/rejection-tracking') as {
      enable: (options: {
        allRejections: boolean;
        onUnhandled: (id: string, error: unknown) => void;
        onHandled: (id: string) => void;
      }) => void;
    };
    tracking.enable({
      allRejections: true,
      onUnhandled: (_id, error) => {
        reportAppErrorFromUnknown(error, {
          context: { source: 'unhandled_promise_rejection' },
        });
      },
      onHandled: () => {},
    });
  } catch {
    /* optional — not available in all runtimes */
  }
}

export function installAppErrorReporting(): void {
  installJsCrashGuard();
  installUnhandledPromiseReporting();
}
