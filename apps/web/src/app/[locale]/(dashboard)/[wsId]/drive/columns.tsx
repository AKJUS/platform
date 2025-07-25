'use client';

import { StorageObjectRowActions } from './row-actions';
import { formatBytes } from '@/utils/file-helper';
import { joinPath, popPath } from '@/utils/path-helper';
import type { ColumnDef } from '@tanstack/react-table';
import type { StorageObject } from '@tuturuuu/types/primitives/StorageObject';
import { DataTableColumnHeader } from '@tuturuuu/ui/custom/tables/data-table-column-header';
import { ChevronLeft, FileText, Folder } from '@tuturuuu/ui/icons';
import moment from 'moment';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Fragment } from 'react';

export const storageObjectsColumns = (
  // biome-ignore lint/suspicious/noExplicitAny: <translations are not typed>
  t: any,
  namespace: string | undefined,
  // eslint-disable-next-line no-unused-vars
  setStorageObject: (value: StorageObject | undefined) => void,
  wsId: string,
  path?: string,
  onRequestDelete?: (obj: StorageObject) => void
): ColumnDef<StorageObject>[] => [
  // {
  //   id: 'select',
  //   header: ({ table }) => (
  //     <Checkbox
  //       checked={table.getIsAllPageRowsSelected()}
  //       onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
  //       aria-label="Select all"
  //       className="translate-y-[2px]"
  //     />
  //   ),
  //   cell: ({ row }) => (
  //     <Checkbox
  //       checked={row.getIsSelected()}
  //       onCheckedChange={(value) => row.toggleSelected(!!value)}
  //       aria-label="Select row"
  //       className="translate-y-[2px]"
  //     />
  //   ),
  //   enableSorting: false,
  //   enableHiding: false,
  // },
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader
        t={t}
        column={column}
        title={t(`${namespace}.id`)}
      />
    ),
    cell: ({ row }) => (
      <div className="line-clamp-1 min-w-32">{row.getValue('id')}</div>
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader
        t={t}
        column={column}
        title={t(`${namespace}.name`)}
      />
    ),
    cell: ({ row }) => {
      // Always call hooks at the top level
      const pathname = usePathname();
      const searchParams = useSearchParams();
      const basePath = searchParams.get('path') ?? '';

      if (row.getValue('id'))
        return (
          <div className="flex min-w-32 items-center gap-2 font-semibold">
            <FileText className="h-4 w-4" />
            {(row.getValue('name') as string | undefined)?.replace(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i,
              ''
            )}
          </div>
        );

      // if id is not given, row is references as a path (folder)
      // therefore, generate path link as param
      return (
        <div className="min-w-32 font-semibold">
          <Link
            href={{
              pathname,
              query: {
                path:
                  row.getValue('name') === '...'
                    ? popPath(basePath)
                    : joinPath(basePath, row.getValue('name')),
              },
            }}
            className="flex items-center gap-2"
          >
            {row.getValue('name') === '...' ? (
              <Fragment>
                <ChevronLeft className="h-4 w-4" />
                {t('common.back')}
              </Fragment>
            ) : (
              <Fragment>
                <Folder className="h-4 w-4" />
                {row.getValue('name')}
              </Fragment>
            )}
          </Link>
        </div>
      );
    },
  },
  {
    accessorKey: 'size',
    header: ({ column }) => (
      <DataTableColumnHeader
        t={t}
        column={column}
        title={t(`${namespace}.size`)}
      />
    ),
    cell: ({ row }) =>
      row.getValue('name') === '...' ? null : (
        <div className="min-w-32">
          {row.original?.metadata?.size !== undefined
            ? formatBytes(row.original.metadata.size)
            : '-'}
        </div>
      ),
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader
        t={t}
        column={column}
        title={t(`${namespace}.created_at`)}
      />
    ),
    cell: ({ row }) =>
      row.getValue('name') === '...' ? null : (
        <div className="min-w-32">
          {row.getValue('created_at')
            ? moment(row.getValue('created_at')).format('DD/MM/YYYY, HH:mm:ss')
            : '-'}
        </div>
      ),
  },
  {
    id: 'actions',
    cell: ({ row }) =>
      row.getValue('name') === '...' ? null : (
        <StorageObjectRowActions
          wsId={wsId}
          row={row}
          path={path}
          setStorageObject={setStorageObject}
          onRequestDelete={onRequestDelete}
        />
      ),
  },
];
