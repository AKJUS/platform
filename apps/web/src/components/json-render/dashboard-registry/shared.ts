'use client';

import { useStateStore, useStateValue } from '@json-render/react';
import { useCallback, useEffect, useState } from 'react';

type SignedUploadResponse = {
  uploads: Array<{
    filename: string;
    signedUrl: string;
    token: string;
    path: string;
  }>;
};

export type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

export type StatDisplayProps = {
  label?: string;
  value?: string | number;
  icon?: string;
  variant?: 'success' | 'warning' | 'error' | string;
};

export type MultiQuizItem = {
  question?: string;
  options?: string[];
  answer?: string;
  correctAnswer?: string;
  explanation?: string;
  randomizeOptions?: boolean;
};

export const useComponentValue = <T,>(
  propValue: T | undefined,
  bindingPath: string | undefined,
  fallbackName: string | undefined,
  defaultValue: T
): [T, (val: T) => void] => {
  const { set } = useStateStore();

  const fallbackPath = fallbackName ? `/${fallbackName}` : undefined;
  const path = bindingPath || fallbackPath;
  const safePath = path || '/__json_render_unbound__';
  const boundValue = useStateValue<T>(safePath);
  const [localValue, setLocalValue] = useState<T>(
    (propValue ?? defaultValue) as T
  );

  useEffect(() => {
    if (!path) {
      setLocalValue((propValue ?? defaultValue) as T);
    }
  }, [path, propValue, defaultValue]);

  const setValue = useCallback(
    (val: T) => {
      if (path) {
        set(path, val);
      } else {
        setLocalValue(val);
      }
    },
    [path, set]
  );

  if (!path) return [localValue, setValue];
  return [(boundValue ?? propValue ?? defaultValue) as T, setValue];
};

export function formatDurationLabel(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function resolveStatsRange(
  period?: string,
  dateFrom?: string,
  dateTo?: string
): { from: Date; to: Date; label: string } {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  const setStartOfDay = (date: Date) => date.setHours(0, 0, 0, 0);
  const setEndOfDay = (date: Date) => date.setHours(23, 59, 59, 999);

  switch (period) {
    case 'today': {
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'Today' };
    }
    case 'this_week': {
      const day = start.getDay();
      const daysToSubtract = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - daysToSubtract);
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'This week' };
    }
    case 'this_month': {
      start.setDate(1);
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'This month' };
    }
    case 'last_30_days': {
      start.setDate(start.getDate() - 29);
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'Last 30 days' };
    }
    case 'custom': {
      const parsedFrom = dateFrom ? new Date(dateFrom) : null;
      const parsedTo = dateTo ? new Date(dateTo) : null;
      if (
        parsedFrom &&
        parsedTo &&
        !Number.isNaN(parsedFrom.getTime()) &&
        !Number.isNaN(parsedTo.getTime())
      ) {
        return {
          from: parsedFrom,
          to: parsedTo,
          label: 'Custom range',
        };
      }
      start.setDate(start.getDate() - 6);
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'Last 7 days' };
    }
    default: {
      start.setDate(start.getDate() - 6);
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'Last 7 days' };
    }
  }
}

export function collectFilesFromValue(value: unknown): File[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is File => item instanceof File);
}

export function normalizeIsoDateTimeInput(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const dateTimeWithSpaceMatch = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})\s+([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
  );
  if (dateTimeWithSpaceMatch) {
    const [, datePart, hours, minutes, seconds = '00'] = dateTimeWithSpaceMatch;
    const normalized = new Date(`${datePart}T${hours}:${minutes}:${seconds}`);
    if (!Number.isNaN(normalized.getTime())) {
      return normalized.toISOString();
    }
  }

  return null;
}

export function resolveTimeTrackingRequestDescription(
  params: Record<string, unknown>
): string {
  if (typeof params.description === 'string') return params.description;

  const values = params.values;
  if (
    values &&
    typeof values === 'object' &&
    typeof (values as Record<string, unknown>).description === 'string'
  ) {
    return (values as Record<string, unknown>).description as string;
  }

  if (typeof params.details === 'string') return params.details;

  return '';
}

export function shouldUseTimeTrackingRequestAction(
  explicitAction: string | undefined,
  values: Record<string, unknown>,
  submitParams: Record<string, unknown>
): boolean {
  if (explicitAction === 'create_time_tracking_request') return true;
  if (explicitAction && explicitAction !== 'submit_form') return false;

  const merged = { ...submitParams, ...values };
  const hasStartTime = typeof merged.startTime === 'string';
  const hasEndTime = typeof merged.endTime === 'string';
  const hasTitle =
    typeof merged.title === 'string' && merged.title.trim().length > 0;
  const hasEvidence =
    collectFilesFromValue(merged.evidence).length > 0 ||
    collectFilesFromValue(merged.attachments).length > 0 ||
    (Array.isArray(merged.imagePaths) && merged.imagePaths.length > 0);

  return hasStartTime && hasEndTime && (hasTitle || hasEvidence);
}

export async function uploadTimeTrackingRequestFiles(
  wsId: string,
  requestId: string,
  files: File[]
): Promise<string[]> {
  if (files.length === 0) return [];

  const uploadUrlRes = await fetch(
    `/api/v1/workspaces/${encodeURIComponent(wsId)}/time-tracking/requests/upload-url`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        files: files.map((file) => ({ filename: file.name })),
      }),
    }
  );

  if (!uploadUrlRes.ok) {
    const body = await uploadUrlRes.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error || 'Failed to prepare file upload'
    );
  }

  const uploadData = (await uploadUrlRes.json()) as SignedUploadResponse;
  if (
    !Array.isArray(uploadData.uploads) ||
    uploadData.uploads.length !== files.length
  ) {
    throw new Error('Upload URL response is invalid');
  }

  await Promise.all(
    uploadData.uploads.map(async (upload, index) => {
      const file = files[index];
      if (!file) return;

      const fileUploadRes = await fetch(upload.signedUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${upload.token}`,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!fileUploadRes.ok) {
        throw new Error(`Failed to upload file "${file.name}"`);
      }
    })
  );

  return uploadData.uploads.map((upload) => upload.path);
}
