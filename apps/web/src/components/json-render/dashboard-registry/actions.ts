'use client';

import {
  buildFormSubmissionMessage,
  buildUiActionSubmissionMessage,
} from '../action-submission';
import {
  collectFilesFromValue,
  normalizeIsoDateTimeInput,
  resolveTimeTrackingRequestDescription,
  uploadTimeTrackingRequestFiles,
} from './shared';

type RegistrySetState = (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;

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
    const { sendMessage } = context || {};
    setState((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      const wsId = typeof params.wsId === 'string' ? params.wsId : undefined;
      if (!wsId) {
        throw new Error('Workspace ID is required');
      }

      const title =
        typeof params.title === 'string' && params.title.trim()
          ? params.title.trim()
          : undefined;
      if (!title) {
        throw new Error('Title is required');
      }

      const startTime = normalizeIsoDateTimeInput(params.startTime);
      const endTime = normalizeIsoDateTimeInput(params.endTime);
      if (!startTime || !endTime) {
        throw new Error(
          'startTime and endTime are required and must be valid date/time values'
        );
      }

      const description = resolveTimeTrackingRequestDescription(params);

      const requestId =
        typeof params.requestId === 'string' && params.requestId
          ? params.requestId
          : crypto.randomUUID();

      const rawEvidence = params.evidence;
      const rawAttachments = params.attachments;
      const files = [
        ...collectFilesFromValue(rawEvidence),
        ...collectFilesFromValue(rawAttachments),
      ].slice(0, 5);

      const preUploadedPaths = Array.isArray(params.imagePaths)
        ? params.imagePaths.filter(
            (path): path is string => typeof path === 'string'
          )
        : [];

      const uploadedPaths = await uploadTimeTrackingRequestFiles(
        wsId,
        requestId,
        files
      );
      const imagePaths = [...preUploadedPaths, ...uploadedPaths];

      if (imagePaths.length === 0) {
        throw new Error(
          'Please attach at least one evidence image before submitting'
        );
      }

      const response = await fetch(
        `/api/v1/workspaces/${encodeURIComponent(wsId)}/time-tracking/requests`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            title,
            description,
            categoryId:
              typeof params.categoryId === 'string' ? params.categoryId : '',
            taskId: typeof params.taskId === 'string' ? params.taskId : '',
            startTime,
            endTime,
            imagePaths,
          }),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ||
            'Failed to submit time tracking request'
        );
      }

      const responseBody = (await response.json().catch(() => null)) as {
        success?: boolean;
        request?: {
          id?: string;
          workspace_id?: string;
        };
      } | null;

      if (!responseBody?.success || !responseBody?.request?.id) {
        throw new Error(
          'Request submission response was incomplete. Please try again.'
        );
      }

      const summaryDescription = description.trim() ? description.trim() : 'N/A';

      if (sendMessage) {
        await sendMessage({
          role: 'user',
          parts: [
            {
              type: 'text',
              text: `### Time Tracking Request Submitted\n\n**Title**: ${title}\n**Description**: ${summaryDescription}\n**Request ID**: ${responseBody.request.id}\n**Evidence Files**: ${imagePaths.length}`,
            },
          ],
        });
      }

      setState((prev) => ({
        ...prev,
        submitting: false,
        success: true,
        message: 'Time tracking request submitted successfully!',
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      setState((prev) => ({
        ...prev,
        submitting: false,
        success: false,
        error: errorMessage,
      }));

      throw error instanceof Error ? error : new Error(errorMessage);
    }
  },
};
