import { describe, expect, it } from 'vitest';
import { resolveRenderUiSpecFromOutput } from '@/components/json-render/render-ui-spec';

const baseSpec = {
  root: 'root',
  elements: {
    root: {
      type: 'Stack',
      props: {},
      children: ['card_1', 'missing_child'],
    },
    card_1: {
      type: 'Card',
      props: { title: 'Overview' },
      children: [],
    },
  },
};

describe('render_ui spec hydration', () => {
  it('resolves spec from standard tool output', () => {
    const resolved = resolveRenderUiSpecFromOutput({ spec: baseSpec });

    expect(resolved).not.toBeNull();
    expect(resolved?.root).toBe('root');
    expect(resolved?.elements.root?.children).toEqual(['card_1']);
  });

  it('resolves spec from nested JSON wrapper', () => {
    const resolved = resolveRenderUiSpecFromOutput({
      output: {
        json: JSON.stringify(baseSpec),
      },
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.root).toBe('root');
  });

  it('returns null when root cannot be resolved', () => {
    const resolved = resolveRenderUiSpecFromOutput({
      spec: {
        root: 'missing',
        elements: {
          card_1: { type: 'Card', props: {}, children: [] },
        },
      },
    });

    expect(resolved).toBeNull();
  });
});
