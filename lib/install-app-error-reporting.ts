/**
 * Installs global hooks that report failures to Koko Bay `/api/app/error-log`.
 */
import { reportAppError, reportAppErrorFromUnknown } from '@/lib/appErrorLog';
import { installJsCrashGuard } from '@/lib/crash-guard';

const CONSOLE_DEDUPE_MS = 15_000;
const recentConsoleReports = new Map<string, number>();

function dedupeKey(parts: string[]): string {
  return parts.join('|').slice(0, 500);
}

function shouldReportConsole(key: string): boolean {
  const now = Date.now();
  const last = recentConsoleReports.get(key);
  if (last != null && now - last < CONSOLE_DEDUPE_MS) return false;
  recentConsoleReports.set(key, now);
  if (recentConsoleReports.size > 200) {
    for (const [k, ts] of recentConsoleReports) {
      if (now - ts > CONSOLE_DEDUPE_MS) recentConsoleReports.delete(k);
    }
  }
  return true;
}

function stringifyLogArg(arg: unknown): string {
  if (arg instanceof Error) {
    return arg.stack ? `${arg.name}: ${arg.message}\n${arg.stack}` : `${arg.name}: ${arg.message}`;
  }
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean' || arg == null) return String(arg);
  try {
    return JSON.stringify(arg);
  } catch {
    return Object.prototype.toString.call(arg);
  }
}

function installConsoleReporting(): void {
  const skipMessage = (message: string) =>
    message.includes('[app-error-log]') || message.includes('[kokobay] Uncaught JS error');

  const wrap =
    (level: 'error' | 'warn', original: typeof console.error) =>
    (...args: unknown[]) => {
      original.apply(console, args);
      try {
        const message = args.map(stringifyLogArg).join(' ').slice(0, 2000);
        if (!message.trim() || skipMessage(message)) return;
        const key = dedupeKey([level, message.slice(0, 240)]);
        if (!shouldReportConsole(key)) return;

        const firstError = args.find((a): a is Error => a instanceof Error);
        reportAppError({
          message: message.slice(0, 2000),
          level,
          name: firstError?.name,
          stack: firstError?.stack,
          context: {
            source: level === 'error' ? 'console.error' : 'console.warn',
            argCount: args.length,
            argsPreview: args.slice(0, 6).map((a) => stringifyLogArg(a).slice(0, 300)),
          },
        });
      } catch {
        /* never break logging */
      }
    };

  console.error = wrap('error', console.error.bind(console));
  console.warn = wrap('warn', console.warn.bind(console));
}

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
  installConsoleReporting();
}
