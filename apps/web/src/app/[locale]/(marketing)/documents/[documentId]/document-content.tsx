'use client';

import { Globe2, Loader2 } from '@tuturuuu/icons';
import type { WorkspaceDocument } from '@tuturuuu/types';
import { useTranslations } from 'next-intl';

interface Props {
  document: WorkspaceDocument;
}

export default function DocumentPageContent({ document }: Props) {
  const t = useTranslations();

  if (!document) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">{t('common.loading')}...</span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col">
      <div className="sticky top-0 z-50 flex h-14 items-center justify-center bg-background">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <h1 className="font-medium text-lg">{document.name}</h1>
              <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-emerald-500 text-sm">
                <Globe2 className="h-4 w-4" />
                {t('common.public_document')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-auto py-6">
        <div className="mx-auto max-w-(--breakpoint-xl) px-4">
          <div className="rounded-lg border bg-background p-6 shadow-sm">
            {/* <BlockEditor document={document.content as any} editable={false} /> */}
          </div>
        </div>
      </div>
    </div>
  );
}
