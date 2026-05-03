'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getBlueGreenMonitoringRequestArchive,
  getBlueGreenMonitoringSnapshot,
  getBlueGreenMonitoringWatcherLogArchive,
  getCronMonitoringExecutionArchive,
  getCronMonitoringSnapshot,
} from '@tuturuuu/internal-api/infrastructure';

export function useBlueGreenMonitoringSnapshot({
  requestPreviewLimit,
  watcherLogLimit,
}: {
  requestPreviewLimit?: number;
  watcherLogLimit?: number;
} = {}) {
  return useQuery({
    queryKey: [
      'infrastructure',
      'monitoring',
      'blue-green',
      'snapshot',
      requestPreviewLimit ?? null,
      watcherLogLimit ?? null,
    ],
    queryFn: () =>
      getBlueGreenMonitoringSnapshot({
        requestPreviewLimit,
        watcherLogLimit,
      }),
    refetchInterval: (query) =>
      query.state.data?.watcher.health === 'live' ? 5000 : 15000,
    staleTime: 2000,
  });
}

export function useBlueGreenMonitoringRequestArchive({
  page,
  pageSize,
  q,
  render,
  route,
  status,
  timeframeDays,
  traffic,
}: {
  page: number;
  pageSize: number;
  q?: string;
  render?: 'all' | 'document' | 'rsc';
  route?: string;
  status?: string;
  timeframeDays: number;
  traffic?: 'all' | 'external' | 'internal';
}) {
  return useQuery({
    queryKey: [
      'infrastructure',
      'monitoring',
      'blue-green',
      'requests',
      page,
      pageSize,
      timeframeDays,
      q ?? '',
      status ?? 'all',
      route ?? 'all',
      render ?? 'all',
      traffic ?? 'all',
    ],
    queryFn: () =>
      getBlueGreenMonitoringRequestArchive({
        page,
        pageSize,
        q,
        render,
        route,
        status,
        timeframeDays,
        traffic,
      }),
    refetchInterval: 15000,
    staleTime: 5000,
  });
}

export function useBlueGreenMonitoringWatcherLogArchive({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: [
      'infrastructure',
      'monitoring',
      'blue-green',
      'watcher-logs',
      page,
      pageSize,
    ],
    queryFn: () =>
      getBlueGreenMonitoringWatcherLogArchive({
        page,
        pageSize,
      }),
    refetchInterval: 15000,
    staleTime: 5000,
  });
}

export function useCronMonitoringSnapshot() {
  return useQuery({
    queryKey: ['infrastructure', 'monitoring', 'cron', 'snapshot'],
    queryFn: () => getCronMonitoringSnapshot(),
    refetchInterval: (query) =>
      (query.state.data?.runs ?? []).some(
        (run) => run.status === 'queued' || run.status === 'processing'
      )
        ? 1000
        : 5000,
    staleTime: 750,
  });
}

export function useCronMonitoringExecutionArchive({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: [
      'infrastructure',
      'monitoring',
      'cron',
      'executions',
      page,
      pageSize,
    ],
    queryFn: () =>
      getCronMonitoringExecutionArchive({
        page,
        pageSize,
      }),
    refetchInterval: 1000,
    staleTime: 750,
  });
}
