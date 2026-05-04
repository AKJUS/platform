'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@tuturuuu/ui/card';
import { getWorkspacePosts } from '@tuturuuu/internal-api';
import { Loader2 } from '@tuturuuu/icons';
import FeatureSummary from '@tuturuuu/ui/custom/feature-summary';
import { DataTable } from '@tuturuuu/ui/custom/tables/data-table';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useQueryStates } from 'nuqs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPostEmailColumns } from './columns';
import PostsFilters from './filters';
import { PostDisplay } from './post-display';
import { postsSearchParamParsers } from './search-params';
import { PostStatusSummary } from './status-summary';
import type {
  PostEmail,
  PostEmailStatusSummary,
  PostsSearchParams,
} from './types';
import { createPostEmailKey, usePosts } from './use-posts';

interface PostsClientProps {
  wsId: string;
  locale: string;
  canApprovePosts: boolean;
  canForceSendPosts: boolean;
  defaultDateRange: {
    start: string;
    end: string;
  };
  searchParams: PostsSearchParams;
}

export default function PostsClient({
  wsId,
  locale,
  canApprovePosts,
  canForceSendPosts,
  defaultDateRange,
  searchParams,
}: PostsClientProps) {
  const t = useTranslations();
  const [queryState, setQueryState] = useQueryStates(postsSearchParamParsers);
  const [posts, setPosts] = usePosts();
  const [selectedPost, setSelectedPost] = useState<PostEmail | null>(null);
  const activeStage = queryState.stage ?? searchParams.stage ?? undefined;
  const currentPage = queryState.page ?? searchParams.page ?? 1;
  const currentPageSize = queryState.pageSize ?? searchParams.pageSize ?? 10;
  const effectiveSearchParams = useMemo(
    () => ({
      approvalStatus:
        queryState.approvalStatus ?? searchParams.approvalStatus ?? undefined,
      end: queryState.end ?? searchParams.end ?? undefined,
      excludedGroups:
        (queryState.excludedGroups?.length ?? 0) > 0
          ? queryState.excludedGroups
          : (searchParams.excludedGroups ?? undefined),
      includedGroups:
        (queryState.includedGroups?.length ?? 0) > 0
          ? queryState.includedGroups
          : (searchParams.includedGroups ?? undefined),
      page: currentPage,
      pageSize: currentPageSize,
      queueStatus: queryState.queueStatus ?? searchParams.queueStatus ?? undefined,
      showAll: queryState.showAll ?? searchParams.showAll ?? undefined,
      stage: activeStage,
      start: queryState.start ?? searchParams.start ?? undefined,
      userId: queryState.userId ?? searchParams.userId ?? undefined,
    }),
    [activeStage, currentPage, currentPageSize, queryState, searchParams]
  );
  const {
    data: postsResponse,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['workspace-posts', wsId, effectiveSearchParams],
    queryFn: () =>
      getWorkspacePosts<PostEmail, PostEmailStatusSummary>(
        wsId,
        effectiveSearchParams
      ),
    placeholderData: (previousData) => previousData,
  });
  const isInitialLoading = isLoading && !postsResponse;
  const postsData = postsResponse
    ? { count: postsResponse.count, data: postsResponse.data }
    : { count: 0, data: [] as PostEmail[] };
  const postsStatus =
    postsResponse?.summary ??
    ({
      approvals: { approved: 0, pending: 0, rejected: 0, skipped: 0 },
      queue: {
        blocked: 0,
        cancelled: 0,
        failed: 0,
        processing: 0,
        queued: 0,
        sent: 0,
        skipped: 0,
      },
      stages: {
        approved_awaiting_delivery: 0,
        delivery_failed: 0,
        missing_check: 0,
        pending_approval: 0,
        processing: 0,
        queued: 0,
        rejected: 0,
        sent: 0,
        skipped: 0,
        undeliverable: 0,
      },
      total: 0,
    } as PostEmailStatusSummary);

  const handleSetParams = useCallback(
    (params: { page?: number; pageSize?: string }) => {
      void setQueryState({
        page: params.page,
        pageSize: params.pageSize ? Number(params.pageSize) : undefined,
      });
    },
    [setQueryState]
  );

  useEffect(() => {
    if (posts.selected && postsData?.data) {
      const found = postsData.data.find(
        (p: PostEmail) => createPostEmailKey(p) === posts.selected
      );
      if (found) {
        setSelectedPost(found);
        return;
      }

      const firstVisiblePost = postsData.data[0] ?? null;
      setSelectedPost(firstVisiblePost);
      if (firstVisiblePost) {
        setPosts({
          ...posts,
          selected: createPostEmailKey(firstVisiblePost),
        });
      }
      return;
    }

    const firstVisiblePost = postsData?.data?.[0] ?? null;
    setSelectedPost(firstVisiblePost);
    if (firstVisiblePost) {
      setPosts({
        ...posts,
        selected: createPostEmailKey(firstVisiblePost),
      });
      return;
    }

    setSelectedPost(null);
  }, [posts, posts.selected, postsData, setPosts]);

  return (
    <div className="space-y-6 p-6">
      <FeatureSummary
        pluralTitle={t('ws-post-emails.plural')}
        singularTitle={t('ws-post-emails.singular')}
        description={t('ws-post-emails.description')}
      />

          <PostStatusSummary
            activeStage={activeStage}
            filteredCount={postsData?.count || 0}
            summary={postsStatus}
            toolbar={
              <PostsFilters
                wsId={wsId}
                statusSummary={postsStatus}
                defaultDateRange={defaultDateRange}
                onRefreshPosts={() => {
                  void refetch();
                }}
                isRefreshing={isFetching}
              />
            }
          />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.95fr)] xl:items-start">
        <Card className="min-w-0 border-border/60 shadow-sm">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-base">
              {t('ws-post-emails.matching_recipients', {
                filtered: postsData?.count || 0,
                total: postsStatus.total,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="relative min-h-144 overflow-y-auto">
              {isInitialLoading ? (
                <div className="flex min-h-72 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <>
                  <DataTable
                    data={postsData?.data || []}
                    namespace="post-email-data-table"
                    columnGenerator={getPostEmailColumns}
                    t={t}
                    extraData={{ locale }}
                    count={postsData?.count || 0}
                    pageIndex={Math.max(currentPage - 1, 0)}
                    pageSize={currentPageSize}
                    defaultVisibility={{
                      id: false,
                      email: false,
                      subject: false,
                      is_completed: false,
                      notes: false,
                      created_at: false,
                      queue_attempt_count: false,
                      queue_status: false,
                      stage: true,
                      approval_status: false,
                      post_title: false,
                      post_content: false,
                    }}
                    disableSearch
                    onRefresh={() => {
                      void refetch();
                    }}
                    resetParams={() => {}}
                    setParams={handleSetParams}
                    onRowClick={(row) => {
                      setPosts({
                        ...posts,
                        selected: createPostEmailKey(row),
                      });
                    }}
                  />
                  {isFetching ? (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/55 backdrop-blur-[1px]">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)] xl:self-start xl:overflow-y-auto">
          <PostDisplay
            wsId={wsId}
            postEmail={selectedPost}
            canApprovePosts={canApprovePosts}
            canForceSendPosts={canForceSendPosts}
          />
        </div>
      </div>
    </div>
  );
}
