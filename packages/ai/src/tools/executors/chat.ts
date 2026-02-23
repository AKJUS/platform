import type { MiraToolContext } from '../mira-tools';

export async function executeSetImmersiveMode(
  args: Record<string, unknown>,
  _ctx: MiraToolContext
) {
  const enabled = args.enabled as boolean;

  return {
    success: true,
    action: 'set_immersive_mode',
    enabled,
    message: `Immersive mode ${enabled ? 'enabled' : 'disabled'}`,
  };
}
