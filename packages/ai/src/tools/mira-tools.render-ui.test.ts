import { describe, expect, it } from 'vitest';
import { executeMiraTool, type MiraToolContext } from './mira-tools';

const dummyCtx = {
  userId: 'user-1',
  wsId: 'ws-1',
  supabase: {} as MiraToolContext['supabase'],
  timezone: 'Asia/Saigon',
} satisfies MiraToolContext;

describe('mira-tools render_ui recovery', () => {
  it('auto-recovers invalid empty render_ui specs', async () => {
    const result = (await executeMiraTool(
      'render_ui',
      {
        root: 'dashboard_root',
        elements: {},
      },
      dummyCtx
    )) as Record<string, unknown>;

    expect(result.recoveredFromInvalidSpec).toBe(true);
    expect(result.warning).toBeTruthy();

    const spec = result.spec as Record<string, unknown>;
    expect(spec.root).toBe('dashboard_root');

    const elements = spec.elements as Record<string, unknown>;
    expect(elements.dashboard_root).toBeTruthy();
  });

  it('passes through valid render_ui specs without recovery', async () => {
    const validSpec = {
      root: 'dashboard_root',
      elements: {
        dashboard_root: {
          type: 'Stack',
          props: { gap: 12 },
          children: [],
        },
      },
    };

    const result = (await executeMiraTool(
      'render_ui',
      validSpec,
      dummyCtx
    )) as Record<string, unknown>;

    expect(result.spec).toEqual(validSpec);
    expect(result.recoveredFromInvalidSpec).toBeUndefined();
  });
});
