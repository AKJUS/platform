'use client';

/**
 * Global fetch interceptor for transparent 429 (rate limit) retry.
 *
 * When ANY fetch call receives a 429 response, this interceptor:
 * 1. Shows a debounced toast notification to the user
 * 2. Waits for the duration specified in the `Retry-After` header
 * 3. Retries the request (up to 3 times)
 * 4. Returns the eventual response to the caller transparently
 *
 * This works with ALL existing fetch calls — no code changes needed.
 * Rate-limited requests (429) were never processed by the server,
 * so retrying is safe for any HTTP method (GET, POST, PUT, DELETE).
 *
 * i18n: Call `setRateLimitMessage(fn)` from a React component inside
 * `NextIntlClientProvider` to provide translated messages. The interceptor
 * installs at module scope (before React renders) with an English fallback.
 */

import { toast } from '@tuturuuu/ui/sonner';

const MAX_RETRIES = 3;

/** Formats the rate-limit toast message. Overridden by `setRateLimitMessage`. */
let formatMessage = (seconds: number): string =>
  `You're being rate limited. Retrying in ${seconds}s…`;

/**
 * Replaces the default English message with a translated formatter.
 * Call this from a React component that has access to `useTranslations`.
 */
export function setRateLimitMessage(fn: (seconds: number) => string) {
  formatMessage = fn;
}

let rateLimitToastActive = false;

function notifyRateLimit(retryAfter: number) {
  if (rateLimitToastActive) return;
  rateLimitToastActive = true;
  toast.warning(formatMessage(retryAfter), {
    duration: (retryAfter + 1) * 1000,
    onDismiss: () => {
      rateLimitToastActive = false;
    },
    onAutoClose: () => {
      rateLimitToastActive = false;
    },
  });
}

let installed = false;

/**
 * Installs the global fetch interceptor. Safe to call multiple times
 * (only installs once). Must be called from client-side code only.
 */
export function installFetchInterceptor() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    let response = await originalFetch(input, init);
    let retries = 0;

    while (response.status === 429 && retries < MAX_RETRIES) {
      retries++;
      const retryAfter = Math.min(
        parseInt(response.headers.get('Retry-After') || '5', 10),
        60 // Cap at 60s to avoid extremely long waits
      );

      notifyRateLimit(retryAfter);

      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));

      response = await originalFetch(input, init);
    }

    return response;
  };
}
