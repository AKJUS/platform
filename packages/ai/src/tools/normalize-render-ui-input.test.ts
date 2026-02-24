import { describe, expect, it } from 'vitest';
import { normalizeRenderUiInputForTool } from './normalize-render-ui-input';

describe('normalizeRenderUiInputForTool', () => {
  it('unwraps json_schema wrapper and normalizes elements', () => {
    const input = {
      json_schema: {
        root: 'root_stack',
        elements: {
          root_stack: {
            type: 'Stack',
            props: { gap: 12 },
            children: ['demo_input'],
          },
          demo_input: {
            type: 'Input',
            props: {
              placeholder: 'Type here',
              bindings: {
                value: { $bindState: '/demoInput' },
              },
            },
          },
        },
      },
    };

    const normalized = normalizeRenderUiInputForTool(input) as any;

    expect(normalized.root).toBe('root_stack');
    expect(normalized.elements.demo_input.children).toEqual([]);
    expect(normalized.elements.demo_input.bindings).toEqual({
      value: { $bindState: '/demoInput' },
    });
    expect(normalized.elements.demo_input.props.bindings).toBeUndefined();
  });

  it('unwraps JSON string payload from json key', () => {
    const input = {
      json: JSON.stringify({
        root: 'root',
        elements: {
          root: {
            type: 'Card',
            props: { title: 'Demo' },
          },
        },
      }),
    };

    const normalized = normalizeRenderUiInputForTool(input) as any;

    expect(normalized.root).toBe('root');
    expect(normalized.elements.root.children).toEqual([]);
    expect(normalized.elements.root.props).toEqual({ title: 'Demo' });
  });

  it('returns input as-is when no spec can be found', () => {
    const input = { random: { nested: true } };
    const normalized = normalizeRenderUiInputForTool(input);
    expect(normalized).toBe(input);
  });
});
