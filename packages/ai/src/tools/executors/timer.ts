import type { MiraToolContext } from '../mira-tools';

export async function executeStartTimer(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const title = args.title as string;

  await ctx.supabase
    .from('time_tracking_sessions')
    .update({ is_running: false, end_time: new Date().toISOString() })
    .eq('user_id', ctx.userId)
    .eq('ws_id', ctx.wsId)
    .eq('is_running', true);

  const now = new Date();

  const { data: session, error } = await ctx.supabase
    .from('time_tracking_sessions')
    .insert({
      title,
      description: (args.description as string) ?? null,
      start_time: now.toISOString(),
      is_running: true,
      user_id: ctx.userId,
      ws_id: ctx.wsId,
      date: now.toISOString().split('T')[0],
    })
    .select('id, title, start_time')
    .single();

  if (error) return { error: error.message };
  return { success: true, message: `Timer started: "${title}"`, session };
}

export async function executeStopTimer(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const sessionId = args.sessionId as string | null;

  let query = ctx.supabase
    .from('time_tracking_sessions')
    .select('id, title, start_time')
    .eq('user_id', ctx.userId)
    .eq('ws_id', ctx.wsId)
    .eq('is_running', true);

  if (sessionId) query = query.eq('id', sessionId);

  const { data: session } = await query.limit(1).single();

  if (!session) return { error: 'No running timer found' };

  const endTime = new Date();
  const startTime = new Date(session.start_time);
  const durationSeconds = Math.round(
    (endTime.getTime() - startTime.getTime()) / 1000
  );

  const { error } = await ctx.supabase
    .from('time_tracking_sessions')
    .update({
      is_running: false,
      end_time: endTime.toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq('id', session.id);

  if (error) return { error: error.message };

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);

  return {
    success: true,
    message: `Timer stopped: "${session.title}" — ${hours}h ${minutes}m`,
    session: {
      id: session.id,
      title: session.title,
      durationSeconds,
      durationFormatted: `${hours}h ${minutes}m`,
    },
  };
}
