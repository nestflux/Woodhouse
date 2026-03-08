import * as Sentry from "npm:@sentry/deno@10";

let _initialized = false;
let _enabled = false;

function ensureInitialized() {
  if (_initialized) return;
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) {
    console.warn("SENTRY_DSN is not set — error tracking disabled");
    _initialized = true;
    return;
  }
  Sentry.init({ dsn });
  _enabled = true;
  _initialized = true;
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
) {
  ensureInitialized();
  if (!_enabled) return;

  if (context) {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export function captureMessage(
  message: string,
  context?: Record<string, unknown>
) {
  ensureInitialized();
  if (!_enabled) return;

  if (context) {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
      Sentry.captureMessage(message);
    });
  } else {
    Sentry.captureMessage(message);
  }
}
