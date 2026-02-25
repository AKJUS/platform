import { describe, expect, it, vi } from 'vitest';
import {
  isStructuredSubmitAction,
  resolveActionHandlerMap,
} from '@/components/json-render/action-routing';

describe('json-render action routing', () => {
  it('detects structured submit action ids', () => {
    expect(isStructuredSubmitAction('submit_form')).toBe(true);
    expect(isStructuredSubmitAction('submit_about_me_form')).toBe(true);
    expect(isStructuredSubmitAction('Submit_Task')).toBe(true);
    expect(isStructuredSubmitAction('submit this form')).toBe(false);
    expect(isStructuredSubmitAction('show_tasks')).toBe(false);
  });

  it('resolves nested handlers map from actions context', () => {
    const submitForm = vi.fn();
    const handlers = resolveActionHandlerMap({
      handlers: { submit_form: submitForm },
    });

    expect(handlers.submit_form).toBe(submitForm);
  });

  it('supports flat action map as fallback', () => {
    const direct = vi.fn();
    const handlers = resolveActionHandlerMap({
      submit_form: direct,
    });

    expect(handlers.submit_form).toBe(direct);
  });
});
