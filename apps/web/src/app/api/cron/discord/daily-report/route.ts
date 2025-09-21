import { type NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const cronSecret =
    process.env.CRON_SECRET ?? process.env.VERCEL_CRON_SECRET ?? '';

  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET or VERCEL_CRON_SECRET is not set' },
      { status: 500 }
    );
  }

  if (req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = await fetch(
    `${process.env.DISCORD_APP_DEPLOYMENT_URL}/daily-report`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
    }
  );

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    data = { ok: false, error: 'Invalid JSON from Discord app' };
  }

  return NextResponse.json(data, { status: response.status });
}
