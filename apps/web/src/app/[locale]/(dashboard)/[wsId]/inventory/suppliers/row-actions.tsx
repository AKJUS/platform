'use client';

import { ProductSupplierForm } from './form';
import type { Row } from '@tanstack/react-table';
import type { ProductSupplier } from '@tuturuuu/types/primitives/ProductSupplier';
import { Button } from '@tuturuuu/ui/button';
import ModifiableDialogTrigger from '@tuturuuu/ui/custom/modifiable-dialog-trigger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tuturuuu/ui/dropdown-menu';
import { toast } from '@tuturuuu/ui/hooks/use-toast';
import { Ellipsis } from '@tuturuuu/ui/icons';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  row: Row<ProductSupplier>;
}

export function ProductSupplierRowActions(props: Props) {
  const t = useTranslations();

  const router = useRouter();
  const data = props.row.original;

  const deleteData = async () => {
    const res = await fetch(
      `/api/v1/workspaces/${data.ws_id}/product-suppliers/${data.id}`,
      {
        method: 'DELETE',
      }
    );

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      toast({
        title: 'Failed to delete workspace category',
        description: data.message,
      });
    }
  };

  const [showEditDialog, setShowEditDialog] = useState(false);

  if (!data.id || !data.ws_id) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
          >
            <Ellipsis className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
            {t('common.edit')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={deleteData}>
            {t('common.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ModifiableDialogTrigger
        data={data}
        open={showEditDialog}
        title={t('ws-product-suppliers.edit')}
        editDescription={t('ws-product-suppliers.edit_description')}
        setOpen={setShowEditDialog}
        form={<ProductSupplierForm wsId={data.ws_id} data={data} />}
      />
    </div>
  );
}
