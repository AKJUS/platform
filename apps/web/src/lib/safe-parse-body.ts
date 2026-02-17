/**
 * Safe body parsing utility with byte-size checks.
 *
 * Protects against oversized payloads (e.g., emoji-heavy strings)
 * by checking raw byte length BEFORE JSON parsing.
 */

import type { ApiErrorResponse } from '@tuturuuu/types/sdk';
import { MAX_REQUEST_BODY_BYTES } from '@tuturuuu/utils/constants';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Safely reads and parses a JSON request body with byte-size enforcement.
 *
 * - Rejects bodies exceeding `maxBytes` (default: 256KB) with HTTP 413.
 * - Returns HTTP 400 for invalid JSON.
 *
 * @example
 * const result = await safeParseBody<{ name: string }>(request);
 * if (result instanceof NextResponse) return result; // error response
 * const { data } = result;
 */
export async function safeParseBody<T = unknown>(
  request: NextRequest,
  maxBytes: number = MAX_REQUEST_BODY_BYTES
): Promise<{ data: T } | NextResponse<ApiErrorResponse>> {
  try {
    // Read raw body text
    const text = await request.text();

    // Check byte size (TextEncoder.encode gives UTF-8 byte length)
    const byteLength = new TextEncoder().encode(text).length;
    if (byteLength > maxBytes) {
      return NextResponse.json(
        {
          error: 'Payload Too Large',
          message: `Request body is ${byteLength} bytes, exceeding the ${maxBytes} byte limit`,
          code: 'PAYLOAD_TOO_LARGE',
        },
        { status: 413 }
      );
    }

    // Parse JSON
    const data = JSON.parse(text) as T;
    return { data };
  } catch (error) {
    // JSON parse error
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
        },
        { status: 400 }
      );
    }

    // Re-throw unexpected errors
    throw error;
  }
}
