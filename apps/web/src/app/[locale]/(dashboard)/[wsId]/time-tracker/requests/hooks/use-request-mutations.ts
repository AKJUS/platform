import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@tuturuuu/ui/sonner';
import { useTranslations } from 'next-intl';

interface ApproveRequestParams {
  wsId: string;
  requestId: string;
}

export function useApproveRequest() {
  const t = useTranslations('time-tracker.requests');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wsId, requestId }: ApproveRequestParams) => {
      const response = await fetch(
        `/api/v1/workspaces/${wsId}/time-tracking/requests/${requestId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve request');
      }

      return response.json();
    },
    onSuccess: (_, { wsId, requestId }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-requests', wsId],
      });
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-request', wsId, requestId],
      });

      toast.success(t('toast.approveSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.approveFailed'));
    },
  });
}

interface RejectRequestParams {
  wsId: string;
  requestId: string;
  rejection_reason: string;
}

export function useRejectRequest() {
  const t = useTranslations('time-tracker.requests');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      wsId,
      requestId,
      rejection_reason,
    }: RejectRequestParams) => {
      if (!rejection_reason.trim()) {
        throw new Error(t('detail.rejectionReasonRequired'));
      }

      const response = await fetch(
        `/api/v1/workspaces/${wsId}/time-tracking/requests/${requestId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reject',
            rejection_reason,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject request');
      }

      return response.json();
    },
    onSuccess: (_, { wsId, requestId }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-requests', wsId],
      });
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-request', wsId, requestId],
      });

      toast.success(t('toast.rejectSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.rejectFailed'));
    },
  });
}

interface RequestMoreInfoParams {
  wsId: string;
  requestId: string;
  needs_info_reason: string;
}

export function useRequestMoreInfo() {
  const t = useTranslations('time-tracker.requests');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      wsId,
      requestId,
      needs_info_reason,
    }: RequestMoreInfoParams) => {
      if (!needs_info_reason.trim()) {
        throw new Error(t('detail.needsInfoReasonRequired'));
      }

      const response = await fetch(
        `/api/v1/workspaces/${wsId}/time-tracking/requests/${requestId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'needs_info',
            needs_info_reason,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to request more information');
      }

      return response.json();
    },
    onSuccess: (_, { wsId, requestId }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-requests', wsId],
      });
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-request', wsId, requestId],
      });

      toast.success(t('toast.requestInfoSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.requestInfoFailed'));
    },
  });
}

interface ResubmitRequestParams {
  wsId: string;
  requestId: string;
}

export function useResubmitRequest() {
  const t = useTranslations('time-tracker.requests');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wsId, requestId }: ResubmitRequestParams) => {
      const response = await fetch(
        `/api/v1/workspaces/${wsId}/time-tracking/requests/${requestId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resubmit' }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resubmit request');
      }

      return response.json();
    },
    onSuccess: (_, { wsId, requestId }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-requests', wsId],
      });
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-request', wsId, requestId],
      });

      toast.success(t('toast.resubmitSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.resubmitFailed'));
    },
  });
}

interface UpdateRequestParams {
  wsId: string;
  requestId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  newImages?: File[];
  removedImages?: string[];
}

async function uploadTimeTrackingImages(
  wsId: string,
  requestId: string,
  files: File[]
): Promise<string[]> {
  const uploadUrl = `/api/v1/workspaces/${wsId}/time-tracking/requests/upload-url`;
  const signedRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId,
      files: files.map((file) => ({ filename: file.name })),
    }),
  });

  if (!signedRes.ok) {
    const body = await signedRes.json().catch(() => ({}));
    const message =
      (body as { error?: string }).error ?? 'Failed to generate upload URLs';
    throw new Error(message);
  }

  const { uploads } = (await signedRes.json()) as {
    uploads: Array<{
      signedUrl: string;
      token: string;
      path: string;
    }>;
  };

  if (!Array.isArray(uploads) || uploads.length !== files.length) {
    throw new Error('Upload URL response mismatch');
  }

  const paths = await Promise.all(
    uploads.map(async ({ signedUrl, token, path }, index) => {
      const file = files[index];
      if (!file) {
        throw new Error('Upload URL response mismatch');
      }
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type || 'image/jpeg',
        },
        body: file,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => '');
        throw new Error(
          `Failed to upload image (${uploadRes.status})${text ? `: ${text}` : ''}`
        );
      }

      return path;
    })
  );

  return paths;
}

export function useUpdateRequest() {
  const t = useTranslations('time-tracker.requests');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      wsId,
      requestId,
      title,
      description,
      startTime,
      endTime,
      newImages = [],
      removedImages = [],
    }: UpdateRequestParams) => {
      const newImagePaths =
        newImages.length > 0
          ? await uploadTimeTrackingImages(wsId, requestId, newImages)
          : [];

      const response = await fetch(
        `/api/v1/workspaces/${wsId}/time-tracking/requests/${requestId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description ?? '',
            startTime,
            endTime,
            removedImages,
            newImagePaths,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update request');
      }

      return response.json();
    },
    onSuccess: (_, { wsId, requestId }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-requests', wsId],
      });
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-request', wsId, requestId],
      });

      toast.success(t('toast.updateSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.updateFailed'));
    },
  });
}

interface AddCommentParams {
  wsId: string;
  requestId: string;
  content: string;
}

export function useAddComment() {
  const t = useTranslations('time-tracker.requests');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, wsId, content }: AddCommentParams) => {
      const response = await fetch(
        `/api/v1/workspaces/${wsId}/time-tracking/requests/${requestId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to post comment');
      }

      return response.json();
    },
    onSuccess: (_, { requestId, wsId }) => {
      // Invalidate comments query
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-request-comments', wsId, requestId],
      });

      toast.success(t('comments.commentPosted'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('comments.commentFailed'));
    },
  });
}

interface UpdateCommentParams {
  wsId: string;
  requestId: string;
  commentId: string;
  content: string;
}

export function useUpdateComment() {
  const t = useTranslations('time-tracker.requests');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      wsId,
      requestId,
      commentId,
      content,
    }: UpdateCommentParams) => {
      const response = await fetch(
        `/api/v1/workspaces/${wsId}/time-tracking/requests/${requestId}/comments/${commentId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update comment');
      }

      return response.json();
    },
    onSuccess: (_, { requestId, wsId }) => {
      // Invalidate comments query
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-request-comments', wsId, requestId],
      });

      toast.success(t('comments.commentUpdated'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.updateFailed'));
    },
  });
}

interface DeleteCommentParams {
  wsId: string;
  requestId: string;
  commentId: string;
}

export function useDeleteComment() {
  const t = useTranslations('time-tracker.requests');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wsId, requestId, commentId }: DeleteCommentParams) => {
      const response = await fetch(
        `/api/v1/workspaces/${wsId}/time-tracking/requests/${requestId}/comments/${commentId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete comment');
      }

      return response.json();
    },
    onSuccess: (_, { requestId, wsId }) => {
      // Invalidate comments query
      queryClient.invalidateQueries({
        queryKey: ['time-tracking-request-comments', wsId, requestId],
      });

      toast.success(t('comments.commentDeleted'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.deleteFailed'));
    },
  });
}
