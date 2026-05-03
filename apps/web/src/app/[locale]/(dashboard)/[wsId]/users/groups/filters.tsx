'use client';

import { MinusCircle, PlusCircle } from '@tuturuuu/icons';
import type { UserGroup } from '@tuturuuu/types/primitives/UserGroup';
import { Label } from '@tuturuuu/ui/label';
import { Switch } from '@tuturuuu/ui/switch';
import { useTranslations } from 'next-intl';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';
import {
  useExcludedUserGroups,
  useWorkspaceUserGroups,
} from '../database/hooks';
import { Filter } from '../filters';

interface FiltersProps {
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean | null) => unknown;
  wsId: string;
}

export default function Filters({
  includeArchived,
  onIncludeArchivedChange,
  wsId,
}: FiltersProps) {
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
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <Switch
          id="include-archived-groups"
          checked={includeArchived}
          onCheckedChange={(checked) =>
            onIncludeArchivedChange(checked ? true : null)
          }
        />
        <Label htmlFor="include-archived-groups" className="text-sm">
          {t('show_archived')}
        </Label>
      </div>
    </>
  );
}
