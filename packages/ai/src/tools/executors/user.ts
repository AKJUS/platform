import type { MiraToolContext } from '../mira-tools';

export async function executeUpdateUserName(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const displayName = args.displayName as string | undefined;
  const fullName = args.fullName as string | undefined;

  if (!displayName && !fullName) {
    return {
      success: false,
      error: 'No name fields provided to update',
      message: 'You must provide at least one of displayName or fullName.',
    };
  }

  const results: Record<string, any> = {};

  if (displayName) {
    const { error } = await ctx.supabase
      .from('users')
      .update({ display_name: displayName })
      .eq('id', ctx.userId);

    if (error) {
      results.displayNameError = error.message;
    } else {
      results.displayNameUpdated = true;
    }
  }

  if (fullName) {
    const { error } = await ctx.supabase
      .from('user_private_details')
      .update({ full_name: fullName })
      .eq('user_id', ctx.userId);

    if (error) {
      results.fullNameError = error.message;
    } else {
      results.fullNameUpdated = true;
    }
  }

  if (results.displayNameError || results.fullNameError) {
    return {
      success: false,
      error: 'Partial or complete failure',
      message: 'Failed to update some or all name fields',
      details: results,
    };
  }

  return {
    success: true,
    message: 'User name updated successfully',
    details: results,
  };
}
