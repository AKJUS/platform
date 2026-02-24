import type { NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { GET as getSoul } from '@/app/api/v1/mira/soul/route';
import {
  buildMiraReadRateLimitKey,
  checkRateLimit,
  MIRA_READ_RATE_LIMIT,
} from '@/lib/rate-limit';

vi.mock('@/lib/rate-limit', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/rate-limit')>(
      '@/lib/rate-limit'
    );

  return {
    ...actual,
    checkRateLimit: vi.fn(actual.checkRateLimit),
  };
});

describe('Mira rate limiting', () => {
  it('builds stable Mira rate-limit keys', () => {
    expect(buildMiraReadRateLimitKey('soul', '1.2.3.4')).toBe(
      'mira:read:soul:1.2.3.4'
    );
    expect(buildMiraReadRateLimitKey('tasks', '')).toBe(
      'mira:read:tasks:unknown'
    );
  });

  it('applies Mira read rate limit on soul GET', async () => {
    const mockedCheck = checkRateLimit as unknown as ReturnType<
      typeof vi.fn
    > & { mock: { calls: unknown[][] } };

    mockedCheck.mockResolvedValueOnce({
      allowed: true,
      headers: {},
    });

    const request = new Request('https://example.com/api/v1/mira/soul', {
      headers: {
        'x-forwarded-for': '203.0.113.10',
      },
    });

    const response = (await getSoul(request)) as NextResponse;

    expect(response.status).toBe(200);
    expect(mockedCheck.mock.calls[0]?.[0]).toBe('mira:read:soul:203.0.113.10');
    expect(mockedCheck.mock.calls[0]?.[1]).toEqual(MIRA_READ_RATE_LIMIT);
  });
});
