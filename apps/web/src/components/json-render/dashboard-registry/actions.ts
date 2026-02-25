'use client';

import {
  buildFormSubmissionMessage,
  buildUiActionSubmissionMessage,
} from '../action-submission';

type RegistrySetState = (
  updater: (prev: Record<string, unknown>) => Record<string, unknown>
) => void;

type RegistryContext = {
  submitText?: (text: string) => void;
  sendMessage?: (message: {
    role: 'user';
    parts: Array<{ type: 'text'; text: string }>;
  }) => Promise<void>;
};

export const dashboardActions = {
  submit_form: async (
    params: Record<string, unknown> | undefined,
    setState: RegistrySetState,
    context: RegistryContext
  ) => {
    if (!params) return;
    const { submitText, sendMessage } = context || {};
    if (!submitText && !sendMessage) {
      setState((prev) => ({
        ...prev,
        error: 'Internal error: sendMessage not found',
      }));
      return;
    }

    setState((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      const messageText = buildFormSubmissionMessage({
        title: params.title,
        values: params.values,
      });

      if (submitText) {
        submitText(messageText);
      } else if (sendMessage) {
        await sendMessage({
          role: 'user',
          parts: [{ type: 'text', text: messageText }],
        });
      }

      setState((prev) => ({
        ...prev,
        submitting: false,
        success: true,
        message: 'Form submitted successfully!',
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  },

  __ui_action__: async (
    params: Record<string, unknown> | undefined,
    setState: RegistrySetState,
    context: RegistryContext
  ) => {
    const { submitText, sendMessage } = context || {};
    if (!submitText && !sendMessage) return;

    setState((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      const messageText = buildUiActionSubmissionMessage({
        id: params?.id,
        label: params?.label,
        source: params?.source,
      });

      if (submitText) {
        submitText(messageText);
      } else if (sendMessage) {
        await sendMessage({
          role: 'user',
          parts: [{ type: 'text', text: messageText }],
        });
      }

      setState((prev) => ({
        ...prev,
        submitting: false,
        success: true,
        message: 'Form submitted successfully!',
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  },

  log_transaction: async (
    params: Record<string, unknown> | undefined,
    setState: RegistrySetState,
    context: RegistryContext
  ) => {
    if (!params) return;
    const { submitText, sendMessage } = context || {};
    setState((prev) => ({ ...prev, submitting: true }));

    try {
      const res = await fetch('/api/v1/finance/transactions', {
        method: 'POST',
        body: JSON.stringify({
          amount: params.amount,
          description: params.description,
          wallet_id: params.walletId,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error('Failed to log transaction');
      }

      if (submitText || sendMessage) {
        const messageText = `### Transaction Logged\n\n**Amount**: ${params.amount}\n**Description**: ${typeof params.description === 'string' ? params.description : 'N/A'}`;
        if (submitText) {
          submitText(messageText);
        } else if (sendMessage) {
          await sendMessage({
            role: 'user',
            parts: [{ type: 'text', text: messageText }],
          });
        }
      }

      setState((prev) => ({
        ...prev,
        submitting: false,
        success: true,
        message: 'Transaction logged successfully!',
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  },
  create_time_tracking_request: async (
    params: Record<string, unknown> | undefined,
    setState: RegistrySetState,
    context: RegistryContext
  ) => {
    if (!params) return;
    const { submitText, sendMessage } = context || {};
    if (!submitText && !sendMessage) {
      setState((prev) => ({
        ...prev,
        error: 'Internal error: sendMessage not found',
      }));
      return;
    }

    setState((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      const messageText = buildFormSubmissionMessage({
        title:
          typeof params.title === 'string'
            ? params.title
            : 'Time tracking request',
        values: params,
      });

      if (submitText) {
        submitText(messageText);
      } else if (sendMessage) {
        await sendMessage({
          role: 'user',
          parts: [{ type: 'text', text: messageText }],
        });
      }

      setState((prev) => ({
        ...prev,
        submitting: false,
        success: true,
        message: 'Time tracking request submitted successfully!',
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  },
};
