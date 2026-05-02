import { generateCrossAppToken } from '@tuturuuu/auth/cross-app';
import { resolveAuthenticatedSessionUser } from '@tuturuuu/supabase/next/auth-session-user';
import { createClient } from '@tuturuuu/supabase/next/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@tuturuuu/auth/cross-app', () => ({
  generateCrossAppToken: vi.fn(),
}));

vi.mock('@tuturuuu/supabase/next/auth-session-user', () => ({
  resolveAuthenticatedSessionUser: vi.fn(),
}));

vi.mock('@tuturuuu/supabase/next/server', () => ({
  createClient: vi.fn(),
}));

describe('CLI auth start route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({} as never);
    vi.mocked(resolveAuthenticatedSessionUser).mockResolvedValue({
      authError: null,
      user: { id: 'user-1' },
    } as never);
    vi.mocked(generateCrossAppToken).mockResolvedValue('cli-token');
  });

  it('redirects only to loopback callback URLs', async () => {
    const response = await GET(
      new NextRequest(
        'https://tuturuuu.com/api/cli/auth/start?state=s1&redirect_uri=http%3A%2F%2F127.0.0.1%3A4389%2Fcallback'
      )
    );

    expect(response.headers.get('location')).toBe(
      'http://127.0.0.1:4389/callback?token=cli-token&state=s1'
    );
  });

  it('rejects non-loopback callback URLs', async () => {
    const response = await GET(
      new NextRequest(
        'https://tuturuuu.com/api/cli/auth/start?state=s1&redirect_uri=https%3A%2F%2Fevil.example%2Fcallback'
      )
    );

    expect(response.status).toBe(400);
  });

  it('returns a copy token payload in copy mode', async () => {
    const response = await GET(
      new NextRequest(
        'https://tuturuuu.com/api/cli/auth/start?state=s1&mode=copy'
      )
    );

    await expect(response.json()).resolves.toEqual({
      token: 'cli-token',
    });
  });
});
