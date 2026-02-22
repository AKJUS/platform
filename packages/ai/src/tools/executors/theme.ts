import type { MiraToolContext } from '../mira-tools';

export async function executeSetTheme(
  args: Record<string, unknown>,
  _ctx: MiraToolContext
) {
  const theme = args.theme as string;
  const valid = ['light', 'dark', 'system'];
  if (!valid.includes(theme)) {
    return {
      error: `Invalid theme "${theme}". Must be one of: ${valid.join(', ')}`,
    };
  }

  // Return a client-side action marker — the chat UI will detect this
  // and apply the theme change via next-themes.
  return {
    success: true,
    action: 'set_theme',
    theme,
    message: `Theme changed to ${theme}`,
  };
}
