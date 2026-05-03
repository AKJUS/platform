'use client';

import { RotateCcw, Save } from '@tuturuuu/icons';
import type { WorkspaceUser } from '@tuturuuu/types/primitives/WorkspaceUser';
import { Button } from '@tuturuuu/ui/button';
import { StickyBottomBar } from '@tuturuuu/ui/sticky-bottom-bar';
import { Tabs, TabsList, TabsTrigger } from '@tuturuuu/ui/tabs';
import { cn } from '@tuturuuu/utils/format';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  AddCategoryDialog,
  AddIndicatorDialog,
  EditIndicatorDialog,
} from './indicator-dialogs';
import { IndicatorSummaryStats } from './indicator-summary-stats';
import { IndicatorTable } from './indicator-table';
import { IndicatorToolbar } from './indicator-toolbar';
import type { GroupIndicator, MetricCategory, UserIndicator } from './types';
import { useIndicators } from './use-indicators';
import UserFeedbackDialog from './user-feedback-dialog';

interface Props {
  wsId: string;
  groupId: string;
  groupName: string;
  users: WorkspaceUser[];
  initialGroupIndicators: GroupIndicator[];
  initialMetricCategories: MetricCategory[];
  initialUserIndicators: UserIndicator[];
  canCreateUserGroupsScores: boolean;
  canUpdateUserGroupsScores: boolean;
  canDeleteUserGroupsScores: boolean;
}

export default function GroupIndicatorsManager({
  wsId,
  groupId,
  groupName,
  users,
  initialGroupIndicators,
  initialMetricCategories,
  initialUserIndicators,
  canCreateUserGroupsScores = false,
  canUpdateUserGroupsScores = false,
  canDeleteUserGroupsScores = false,
}: Props) {
  const t = useTranslations();
  const tIndicators = useTranslations('ws-user-group-indicators');

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [selectedCategoryView, setSelectedCategoryView] = useState('all');
  const [selectedIndicator, setSelectedIndicator] =
    useState<GroupIndicator | null>(null);
  const [selectedUser, setSelectedUser] = useState<WorkspaceUser | null>(null);

  const {
    groupIndicators,
    metricCategories,
    userIndicators,
    managerUserIds,
    createVitalMutation,
    createCategoryMutation,
    updateIndicatorMutation,
    deleteIndicatorMutation,
    handleValueChange,
    isValuePending,
    getIndicatorValue,
    calculateAverage,
    canEditCell,
    hasChanges,
    isAnyMutationPending,
    isSubmitting,
    handleReset,
    handleSubmit,
  } = useIndicators({
    wsId,
    groupId,
    initialGroupIndicators,
    initialMetricCategories,
    initialUserIndicators,
    canCreate: canCreateUserGroupsScores,
    canUpdate: canUpdateUserGroupsScores,
    canDelete: canDeleteUserGroupsScores,
  });

  // Filter out managers from the displayed user list
  const displayedUsers = useMemo(
    () => users.filter((u) => !managerUserIds.has(u.id)),
    [users, managerUserIds]
  );

  // Set of displayed user IDs for accurate stats filtering
  const displayedUserIds = useMemo(
    () => new Set(displayedUsers.map((u) => u.id)),
    [displayedUsers]
  );

  const hasUncategorizedIndicators = useMemo(
    () =>
      groupIndicators.some((indicator) => indicator.categories.length === 0),
    [groupIndicators]
  );

  const visibleIndicators = useMemo(() => {
    if (selectedCategoryView === 'all') return groupIndicators;
    if (selectedCategoryView === 'uncategorized') {
      return groupIndicators.filter(
        (indicator) => indicator.categories.length === 0
      );
    }

    return groupIndicators.filter((indicator) =>
      indicator.categories.some(
        (category) => category.id === selectedCategoryView
      )
    );
  }, [groupIndicators, selectedCategoryView]);

  const openEditDialog = (indicator: GroupIndicator) => {
    setSelectedIndicator(indicator);
    setEditDialogOpen(true);
  };

  const openFeedbackDialog = (user: WorkspaceUser) => {
    setSelectedUser(user);
    setFeedbackDialogOpen(true);
  };

  return (
    <div>
      <StickyBottomBar
        show={hasChanges}
        message={t('common.unsaved-changes')}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              disabled={isAnyMutationPending}
            >
              <RotateCcw className="h-4 w-4" />
              {t('common.reset')}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isAnyMutationPending}
              className={cn(
                'border border-dynamic-blue/20 bg-dynamic-blue/10 text-dynamic-blue hover:bg-dynamic-blue/20'
              )}
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        <IndicatorToolbar
          canCreate={canCreateUserGroupsScores}
          onAddCategoryClick={() => setAddCategoryDialogOpen(true)}
          onAddIndicatorClick={() => setAddDialogOpen(true)}
        />

        {(metricCategories.length > 0 || hasUncategorizedIndicators) && (
          <Tabs
            value={selectedCategoryView}
            onValueChange={setSelectedCategoryView}
          >
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
              {metricCategories.map((category) => (
                <TabsTrigger key={category.id} value={category.id}>
                  {category.name}
                </TabsTrigger>
              ))}
              {hasUncategorizedIndicators && (
                <TabsTrigger value="uncategorized">
                  {tIndicators('uncategorized')}
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        )}

        {visibleIndicators.length > 0 && (
          <IndicatorSummaryStats
            groupIndicators={visibleIndicators}
            userIndicators={userIndicators}
            userIds={displayedUserIds}
          />
        )}

        <IndicatorTable
          groupIndicators={visibleIndicators}
          users={displayedUsers}
          canUpdate={canUpdateUserGroupsScores}
          getIndicatorValue={getIndicatorValue}
          handleValueChange={handleValueChange}
          isValuePending={isValuePending}
          canEditCell={canEditCell}
          calculateAverage={calculateAverage}
          onEditIndicator={openEditDialog}
          onUserClick={openFeedbackDialog}
        />
      </div>

      <AddIndicatorDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        createMutation={createVitalMutation}
        metricCategories={metricCategories}
        isAnyMutationPending={isAnyMutationPending}
      />

      <AddCategoryDialog
        open={addCategoryDialogOpen}
        onOpenChange={setAddCategoryDialogOpen}
        createMutation={createCategoryMutation}
        isAnyMutationPending={isAnyMutationPending}
      />

      <EditIndicatorDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        indicator={selectedIndicator}
        updateMutation={updateIndicatorMutation}
        deleteMutation={deleteIndicatorMutation}
        metricCategories={metricCategories}
        canDelete={canDeleteUserGroupsScores}
        isAnyMutationPending={isAnyMutationPending}
      />

      <UserFeedbackDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
        user={selectedUser}
        groupName={groupName}
        wsId={wsId}
        groupId={groupId}
      />
    </div>
  );
}
