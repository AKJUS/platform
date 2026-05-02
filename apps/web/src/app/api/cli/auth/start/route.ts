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

function escapeHtml(value: string) {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function acceptsJson(request: NextRequest) {
  return request.headers.get('accept')?.includes('application/json') ?? false;
}

function renderCopyTokenPage(token: string, email: string | null) {
  const safeToken = escapeHtml(token);
  const safeEmail = email ? escapeHtml(email) : null;

  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tuturuuu CLI login</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body {
        align-items: center;
        background: Canvas;
        color: CanvasText;
        display: grid;
        margin: 0;
        min-height: 100vh;
        padding: 24px;
      }

      main {
        margin: 0 auto;
        max-width: 720px;
        width: min(100%, 720px);
      }

      h1 {
        font-size: 28px;
        line-height: 1.15;
        margin: 0 0 12px;
      }

      p {
        color: color-mix(in srgb, CanvasText 72%, Canvas);
        line-height: 1.6;
        margin: 0 0 18px;
      }

      code {
        background: color-mix(in srgb, CanvasText 8%, Canvas);
        border: 1px solid color-mix(in srgb, CanvasText 14%, Canvas);
        border-radius: 8px;
        display: block;
        font: 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        overflow-wrap: anywhere;
        padding: 16px;
        user-select: all;
      }

      .meta {
        font-size: 14px;
        margin-top: 18px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Finish Tuturuuu CLI login</h1>
      <p>Copy this token, return to your terminal, and paste it at the prompt.</p>
      <code>${safeToken}</code>
      ${
        safeEmail
          ? `<p class="meta">Signed in as <strong>${safeEmail}</strong>.</p>`
          : ''
      }
    </main>
  </body>
</html>`,
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
      },
    }
  );
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

  const email = user.email ?? null;

  if (request.nextUrl.searchParams.get('mode') === 'copy') {
    if (acceptsJson(request)) {
      return NextResponse.json(
        { email, token },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    return renderCopyTokenPage(token, email);
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
  if (email) {
    callbackUrl.searchParams.set('email', email);
  }

  return NextResponse.redirect(callbackUrl);
}
