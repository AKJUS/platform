import { describe, expect, it } from 'vitest';
import {
  buildFormSubmissionMessage,
  buildUiActionSubmissionMessage,
} from '@/components/json-render/action-submission';

describe('json-render action submissions', () => {
  it('builds compact form submission text with humanized fields', () => {
    const message = buildFormSubmissionMessage({
      title: 'Create Task',
      values: {
        taskName: 'Plan Q2 roadmap',
        notifyTeam: true,
        tags: ['planning', 'priority'],
        submitting: true,
      },
    });

    expect(message).toContain('### Create Task');
    expect(message).toContain('**Task Name**: Plan Q2 roadmap');
    expect(message).toContain('**Notify Team**: Yes');
    expect(message).toContain('**Tags**: planning, priority');
    expect(message).not.toContain('submitting');
  });

  it('builds a follow-up message for generic UI actions', () => {
    const message = buildUiActionSubmissionMessage({
      id: 'show me my top overdue tasks',
      source: 'button',
    });

    expect(message).toContain('### UI Action');
    expect(message).toContain('**Action**: show me my top overdue tasks');
    expect(message).toContain('**Source**: button');
  });

  it('falls back to label for opaque action IDs', () => {
    const message = buildUiActionSubmissionMessage({
      id: 'view_tx_1',
      label: 'Open transaction details',
    });

    expect(message).toContain('**Action**: Open transaction details');
  });
});
