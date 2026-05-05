import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MFA_MOBILE_APPROVAL_COOKIE_NAME,
  MFA_MOBILE_APPROVAL_KIND,
} from '../mfa-mobile-approval';
import {
  createCentralizedAuthProxy,
  normalizeAuthRedirectPath,
  resolveCanonicalRequestOrigin,
} from './index';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock('@tuturuuu/supabase/next/proxy', () => ({
  updateSession: (...args: Parameters<typeof mocks.updateSession>) =>
    mocks.updateSession(...args),
}));

vi.mock('@tuturuuu/supabase/next/server', () => ({
  createAdminClient: (...args: Parameters<typeof mocks.createAdminClient>) =>
    mocks.createAdminClient(...args),
  createClient: (...args: Parameters<typeof mocks.createClient>) =>
    mocks.createClient(...args),
}));

describe('auth proxy redirect helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSession.mockResolvedValue({
      claims: null,
      res: NextResponse.next(),
    });
    mocks.createClient.mockResolvedValue({
      auth: {
        mfa: {
          listFactors: vi.fn().mockResolvedValue({ data: { totp: [] } }),
        },
      },
    });
    mocks.createAdminClient.mockResolvedValue({
      from: vi.fn(),
    });
  });

  it('resolves the canonical public origin from forwarded headers', () => {
    const request = new NextRequest('http://0.0.0.0:7803/dashboard', {
      headers: {
        'x-forwarded-host': 'tuturuuu.com',
        'x-forwarded-proto': 'https',
      },
    });

    expect(resolveCanonicalRequestOrigin(request, 'https://tuturuuu.com')).toBe(
      'https://tuturuuu.com'
    );
  });

  it('flattens nested login and verify-token redirect chains', () => {
    const nestedTarget = encodeURIComponent(
      '/verify-token?nextUrl=%2Fworkspace%2Fdemo%3Ftab%3Dmail'
    );

    expect(
      normalizeAuthRedirectPath(
        `/login?returnUrl=${nestedTarget}`,
        'https://tuturuuu.com'
      )
    ).toBe('/workspace/demo?tab=mail');
  });

  it('redirects unauthenticated users through the public origin instead of the internal bind host', async () => {
    const authProxy = createCentralizedAuthProxy({
      skipApiRoutes: true,
      webAppUrl: 'https://tuturuuu.com',
    });
    const request = new NextRequest('http://0.0.0.0:7803/mail', {
      headers: {
        host: '0.0.0.0:7803',
        'x-forwarded-host': 'tuturuuu.com',
        'x-forwarded-proto': 'https',
      },
    });

    const response = await authProxy(request);
    const location = response.headers.get('location');

    expect(location).toBeTruthy();
    expect(location).toContain('https://tuturuuu.com/login?returnUrl=');
    expect(location).toContain(
      encodeURIComponent('https://tuturuuu.com/verify-token?nextUrl=%2Fmail')
    );
    expect(location).not.toContain('0.0.0.0:7803');
  });

  it('lets aal1 sessions through when a consumed mobile MFA approval cookie is valid', async () => {
    const validUntil = new Date(Date.now() + 60_000).toISOString();
    const builder = {
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          approval_metadata: { mobileMfaValidUntil: validUntil },
          approver_user_id: 'user-1',
          request_metadata: { kind: MFA_MOBILE_APPROVAL_KIND },
          status: 'consumed',
        },
        error: null,
      }),
      select: vi.fn(() => builder),
    };
    const adminClient = {
      from: vi.fn(() => builder),
    };

    mocks.updateSession.mockResolvedValue({
      claims: { aal: 'aal1', sub: 'user-1' },
      res: NextResponse.next(),
    });
    mocks.createClient.mockResolvedValue({
      auth: {
        mfa: {
          listFactors: vi.fn().mockResolvedValue({
            data: { totp: [{ status: 'verified' }] },
          }),
        },
      },
    });
    mocks.createAdminClient.mockResolvedValue(adminClient);

    const authProxy = createCentralizedAuthProxy({
      skipApiRoutes: true,
      webAppUrl: 'https://tuturuuu.com',
    });
    const request = new NextRequest('https://tuturuuu.com/mail', {
      headers: {
        cookie: `${MFA_MOBILE_APPROVAL_COOKIE_NAME}=challenge-1.secret-1`,
      },
    });

    const response = await authProxy(request);

    expect(response.headers.get('location')).toBeNull();
    expect(adminClient.from).toHaveBeenCalledWith('qr_login_challenges');
  });
});
