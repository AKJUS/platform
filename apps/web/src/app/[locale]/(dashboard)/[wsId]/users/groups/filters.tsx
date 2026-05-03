'use client';

import { Archive, MinusCircle, PlusCircle } from '@tuturuuu/icons';
import type { UserGroup } from '@tuturuuu/types/primitives/UserGroup';
import { Button } from '@tuturuuu/ui/button';
import { useTranslations } from 'next-intl';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';
import {
  useExcludedUserGroups,
  useWorkspaceUserGroups,
} from '../database/hooks';
import { Filter } from '../filters';

export default function Filters({
  wsId,
  includeArchived,
  onIncludeArchivedChange,
}: {
  wsId: string;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean | null) => void;
}) {
  const t = useTranslations('user-group-data-table');

  const [includedTags] = useQueryState(
    'includedTags',
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({
      shallow: true,
    })
  );

  const { data: tags = [] } = useWorkspaceUserGroups(wsId);
  const { data: excludedTags = [] } = useExcludedUserGroups(wsId, includedTags);

  return (
    <>
      <Filter
        key="included-user-tags-filter"
        tag="includedTags"
        title={t('included_tags')}
        icon={<PlusCircle className="mr-2 h-4 w-4" />}
        options={tags.map((tag: UserGroup) => ({
          label: tag.name || 'No name',
          value: tag.id,
          count: tag.amount,
        }))}
        disabled
      />
      <Filter
        key="excluded-user-tags-filter"
        tag="excludedTags"
        title={t('excluded_tags')}
        icon={<MinusCircle className="mr-2 h-4 w-4" />}
        options={excludedTags.map((tag: UserGroup) => ({
          label: tag.name || 'No name',
          value: tag.id,
          count: tag.amount,
        }))}
        disabled
      />
      <Button
        type="button"
        variant={includeArchived ? 'default' : 'outline'}
        size="sm"
        onClick={() => onIncludeArchivedChange(includeArchived ? null : true)}
      >
        <Archive className="mr-2 h-4 w-4" />
        {t('include_archived')}
      </Button>
    </>
  );
}
