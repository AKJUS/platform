'use client';

import { Loader2 } from '@tuturuuu/icons';
import type { WorkspaceUserReport } from '@tuturuuu/types';
import type { WorkspaceConfig } from '@tuturuuu/types/primitives/WorkspaceConfig';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@tuturuuu/ui/alert-dialog';
import ReportPreview from '@tuturuuu/ui/custom/report-preview';
import { Progress } from '@tuturuuu/ui/progress';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { useReportDynamicText } from '../../../../reports/[reportId]/hooks/use-report-dynamic-text';
import { useBulkReportExport } from '../../../../reports/[reportId]/hooks/use-report-export';

type BulkExportReport = WorkspaceUserReport & {
  user_name?: string | null;
  group_name?: string | null;
  creator_name?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports: BulkExportReport[];
  configs: WorkspaceConfig[];
  lang: string;
  theme: 'light' | 'dark';
}

export function BulkReportExporter({
  open,
  onOpenChange,
  reports,
  configs,
  lang,
  theme,
}: Props) {
  const t = useTranslations();
  const configMap = useMemo(() => {
    const map = new Map<string, string>();
    configs.forEach((config) => {
      if (config.id && config.value) {
        map.set(config.id, config.value);
      }
    });
    return map;
  }, [configs]);

  const getConfig = useCallback((id: string) => configMap.get(id), [configMap]);

  const { currentReport, isProcessing, completedCount, progress } =
    useBulkReportExport({
      open,
      onOpenChange,
      reports,
      isDarkPreview: theme === 'dark',
      getMetadata: (report) => ({
        userName: report.user_name,
        groupName: report.group_name,
        title: report.title,
      }),
    });

  const parseDynamicText = useReportDynamicText({
    userName: currentReport?.user_name,
    groupName: currentReport?.group_name,
    groupManagerName: currentReport?.creator_name,
  });

  if (!open) return null;

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isProcessing
                ? t('ws-reports.exporting_png')
                : t('ws-reports.export_png_success')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {completedCount} / {reports.length}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Progress value={progress} className="h-2" />
          </div>

          <AlertDialogFooter>
            <AlertDialogAction
              disabled={isProcessing}
              onClick={() => onOpenChange(false)}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.processing')}
                </>
              ) : (
                t('common.close')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden container for rendering reports */}
      <div className="fixed top-0 left-0 -z-50 h-0 w-0 overflow-hidden opacity-0">
        {currentReport && (
          <div id="bulk-export-container">
            <div
              id="bulk-export-printable-area"
              className={`h-[297mm] w-[210mm] ${
                theme === 'dark' ? 'bg-foreground/10' : 'bg-white'
              }`}
            >
              <ReportPreview
                t={t}
                lang={lang}
                parseDynamicText={parseDynamicText}
                getConfig={getConfig}
                theme={theme}
                data={{
                  title: currentReport.title || '',
                  content: currentReport.content || '',
                  score: currentReport.score?.toString() || '',
                  feedback: currentReport.feedback || '',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
