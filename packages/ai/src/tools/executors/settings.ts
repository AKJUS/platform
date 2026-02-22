import type { MiraToolContext } from '../mira-tools';

export async function executeUpdateMySettings(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const updates: Record<string, string> = {};
  const fields = [
    'name',
    'tone',
    'personality',
    'boundaries',
    'vibe',
    'chat_tone',
  ] as const;

  for (const field of fields) {
    const value = args[field];
    if (typeof value === 'string') {
      updates[field] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { success: true, message: 'No settings to update' };
  }

  const { error } = await ctx.supabase
    .from('mira_soul')
    .upsert({ user_id: ctx.userId, ...updates }, { onConflict: 'user_id' });

  if (error) return { error: error.message };

  const changedFields = Object.keys(updates).join(', ');
  return {
    success: true,
    message: `Settings updated: ${changedFields}`,
    updated: updates,
  };
}
