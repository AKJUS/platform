import { describe, expect, it, vi } from 'vitest';
import { dispatchUiAction } from '@/components/json-render/action-dispatch';

describe('dispatchUiAction', () => {
  it('calls direct action handler when available', () => {
    const direct = vi.fn();
    const generic = vi.fn();

    dispatchUiAction(
      {
        handlers: {
          open_details: direct,
          __ui_action__: generic,
        },
      },
      'open_details',
      { id: 'open_details', source: 'button' }
    );

    expect(direct).toHaveBeenCalledTimes(1);
    expect(generic).not.toHaveBeenCalled();
  });

  it('falls back to __ui_action__ when action id is unknown', () => {
    const generic = vi.fn();

    dispatchUiAction(
      {
        handlers: {
          __ui_action__: generic,
        },
      },
      'view_task_123',
      { id: 'view_task_123', label: 'View Task', source: 'list-item' }
    );

    expect(generic).toHaveBeenCalledTimes(1);
    expect(generic).toHaveBeenCalledWith({
      id: 'view_task_123',
      label: 'View Task',
      source: 'list-item',
    });
  });

  it('supports flat action maps for compatibility', () => {
    const generic = vi.fn();

    dispatchUiAction(
      {
        __ui_action__: generic,
      },
      'unknown_action',
      { id: 'unknown_action', source: 'button' }
    );

    expect(generic).toHaveBeenCalledTimes(1);
  });
});
