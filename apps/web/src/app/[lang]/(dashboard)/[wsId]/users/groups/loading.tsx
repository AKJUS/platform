import { getUserGroupColumns } from '@/data/columns/user-groups';
import { DataTable } from '@repo/ui/components/ui/custom/tables/data-table';

export default function Loading() {
  return (
    <DataTable
      columnGenerator={getUserGroupColumns}
      namespace="user-group-data-table"
      defaultVisibility={{
        id: false,
        created_at: false,
      }}
    />
  );
}
