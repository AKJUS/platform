import { createDetachedClient } from '@tuturuuu/supabase/next/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@tuturuuu/supabase/next/server', () => ({
  createDetachedClient: vi.fn(),
}));

describe('CLI auth refresh route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createDetachedClient).mockReturnValue({
      auth: {
        refreshSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: 'access-token',
              expires_at: 123,
              expires_in: 3600,
              refresh_token: 'refresh-token',
              token_type: 'bearer',
            },
          },
          error: null,
        }),
      },
    } as never);
  });

  it('refreshes a CLI session from a refresh token', async () => {
    const response = await POST(
      new NextRequest('https://tuturuuu.com/api/cli/auth/refresh', {
        body: JSON.stringify({ refreshToken: 'old-refresh' }),
        method: 'POST',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      },
      sessionCreated: true,
      valid: true,
    });
  });
});
