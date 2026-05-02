import { generateCrossAppToken } from '@tuturuuu/auth/cross-app';
import { resolveAuthenticatedSessionUser } from '@tuturuuu/supabase/next/auth-session-user';
import { createClient } from '@tuturuuu/supabase/next/server';
import { type NextRequest, NextResponse } from 'next/server';

function isLoopbackCallback(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
      url.pathname === '/callback'
    );
  } catch {
    return false;
  }
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('returnUrl', request.nextUrl.toString());
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state')?.trim();
  if (!state) {
    return NextResponse.json({ error: 'Missing state' }, { status: 400 });
  }

  const supabase = await createClient(request);
  const { user, authError } = await resolveAuthenticatedSessionUser(supabase);

  if (authError || !user) {
    return redirectToLogin(request);
  }

  const token = await generateCrossAppToken(supabase, 'platform', 'cli', 300);
  if (!token) {
    return NextResponse.json(
      { error: 'Failed to generate CLI token' },
      { status: 500 }
    );
  }

  if (request.nextUrl.searchParams.get('mode') === 'copy') {
    return NextResponse.json({ token });
  }

  const redirectUri = request.nextUrl.searchParams.get('redirect_uri');
  if (!redirectUri || !isLoopbackCallback(redirectUri)) {
    return NextResponse.json(
      { error: 'Invalid CLI callback URL' },
      { status: 400 }
    );
  }

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('token', token);
  callbackUrl.searchParams.set('state', state);

  return NextResponse.redirect(callbackUrl);
}
