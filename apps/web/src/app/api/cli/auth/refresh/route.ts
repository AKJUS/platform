import { createDetachedClient } from '@tuturuuu/supabase/next/server';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = refreshSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const detached = createDetachedClient();
  const { data, error } = await detached.auth.refreshSession({
    refresh_token: parsed.data.refreshToken,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: 'Invalid or expired refresh token' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    session: {
      access_token: data.session.access_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      refresh_token: data.session.refresh_token,
      token_type: data.session.token_type,
    },
    sessionCreated: true,
    valid: true,
  });
}
