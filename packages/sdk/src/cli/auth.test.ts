import { describe, expect, it, vi } from 'vitest';
import { exchangeCliToken } from './auth';

describe('CLI auth exchange', () => {
  it('uses the CLI-specific verification route and session label', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          session: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_at: 123,
            expires_in: 3600,
            token_type: 'bearer',
          },
          sessionCreated: true,
          userId: 'user-1',
          valid: true,
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }
      )
    );

    const result = await exchangeCliToken({
      baseUrl: 'https://tuturuuu.com',
      fetch: fetchMock,
      token: 'copy-token',
    });

    expect(result.session.access_token).toBe('access-token');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://tuturuuu.com/api/cli/auth/verify',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-CLI-Session-Name': 'Tuturuuu CLI',
        }),
        body: JSON.stringify({ token: 'copy-token' }),
      })
    );
  });
});
