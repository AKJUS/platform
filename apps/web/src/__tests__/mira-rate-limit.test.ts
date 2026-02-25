import { describe, expect, it, vi } from 'vitest';
import { buildMiraReadRateLimitKey } from '@/lib/rate-limit';

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
});
