'use client';

import { useLocalStorage } from '@tuturuuu/ui/hooks/use-local-storage';
import { toast } from '@tuturuuu/ui/sonner';
import { escape as escapeString } from 'lodash';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildReportPrintContent } from './report-print-template';

export type ExportType = 'print' | 'image';

export interface ReportExportMetadata {
  title?: string | null;
  userName?: string | null;
  groupName?: string | null;
}

interface ExportReportPngOptions {
  elementId: string;
  isDarkPreview: boolean;
  metadata: ReportExportMetadata;
}

interface UseBulkReportExportOptions<TReport> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports: TReport[];
  isDarkPreview: boolean;
  getMetadata: (report: TReport) => ReportExportMetadata;
  elementId?: string;
  renderWaitMs?: number;
}

function sanitizeFilename(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9\s\u00C0-\u024F\u1E00-\u1EFF]/g, '_')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}

function buildPngFilename({
  title,
  userName,
  groupName,
}: ReportExportMetadata): string {
  const parts = [
    userName && sanitizeFilename(userName),
    groupName && sanitizeFilename(groupName),
    title ? sanitizeFilename(title) : 'report',
  ].filter(Boolean);

  return `${parts.join('_')}.png`;
}

export async function exportReportAsPng({
  elementId,
  isDarkPreview,
  metadata,
}: ExportReportPngOptions): Promise<void> {
  const html2canvas = (await import('html2canvas-pro')).default;
  const printableArea = document.getElementById(elementId);

  if (!printableArea) {
    throw new Error('Preview area not found');
  }

  const canvas = await html2canvas(printableArea, {
    scale: 2,
    useCORS: true,
    backgroundColor: isDarkPreview ? '#1a1a1a' : '#ffffff',
    width: printableArea.offsetWidth,
    height: printableArea.offsetHeight,
  });

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create image'));
          return;
        }

        try {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = buildPngFilename(metadata);

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      'image/png',
      1.0
    );
  });
}

export function useReportExport({
  previewTitle,
  isDarkPreview,
  userName,
  groupName,
}: {
  previewTitle: string;
  isDarkPreview: boolean;
  userName?: string;
  groupName?: string;
}): {
  handlePrintExport: () => void;
  handlePngExport: () => Promise<void>;
  isExporting: boolean;
  defaultExportType: ExportType;
  setDefaultExportType: (
    value: ExportType | ((val: ExportType) => ExportType)
  ) => void;
} {
  const t = useTranslations();
  const [isExporting, setIsExporting] = useState(false);
  const [defaultExportType, setDefaultExportType] = useLocalStorage<ExportType>(
    'report-export-type',
    'image'
  );

  const handlePrintExport = () => {
    const printableArea = document.getElementById('printable-area');
    if (!printableArea) {
      toast.error(t('ws-reports.report_export_not_found'));
      return;
    }

    const stylesheets = Array.from(document.styleSheets)
      .map((styleSheet) => {
        try {
          if (styleSheet.href) {
            return `<link rel="stylesheet" href="${styleSheet.href}">`;
          } else if (styleSheet.ownerNode) {
            const styleElement = styleSheet.ownerNode as HTMLStyleElement;
            return `<style>${styleElement.innerHTML}</style>`;
          }
        } catch (_e) {
          if (styleSheet.href) {
            return `<link rel="stylesheet" href="${styleSheet.href}">`;
          }
        }
        return '';
      })
      .join('\n');

    const escapedTitle = escapeString(previewTitle || t('common.untitled'));

    const printContent = buildReportPrintContent({
      printableAreaHtml: printableArea.outerHTML,
      documentTitle: `${t('ws-reports.report')} - ${escapedTitle}`,
      stylesheets,
    });

    const blob = new Blob([printContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (printWindow) {
      const revoke = () => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {
          // no-op
        }
      };
      printWindow.addEventListener('beforeunload', revoke, { once: true });
      setTimeout(revoke, 60_000);
    } else {
      URL.revokeObjectURL(url);
    }
  };

  const handlePngExport = async () => {
    setIsExporting(true);
    try {
      await exportReportAsPng({
        elementId: 'printable-area',
        isDarkPreview,
        metadata: {
          title: previewTitle,
          userName,
          groupName,
        },
      });
      toast.success(t('ws-reports.export_png_success'));
    } catch (error) {
      console.error('PNG export failed:', error);
      toast.error(t('ws-reports.failed_export_png'));
    } finally {
      setIsExporting(false);
    }
  };

  return {
    handlePrintExport,
    handlePngExport,
    isExporting,
    defaultExportType,
    setDefaultExportType,
  };
}

export function useBulkReportExport<TReport>({
  open,
  onOpenChange,
  reports,
  isDarkPreview,
  getMetadata,
  elementId = 'bulk-export-printable-area',
  renderWaitMs = 500,
}: UseBulkReportExportOptions<TReport>): {
  currentReport: TReport | null;
  isProcessing: boolean;
  completedCount: number;
  progress: number;
} {
  const t = useTranslations();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const isProcessingCurrentRef = useRef(false);

  const currentReport = reports[currentIndex] ?? null;

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setCompletedCount(0);
    setIsProcessing(false);
    isProcessingCurrentRef.current = false;
  }, []);

  const processCurrentReport = useCallback(async () => {
    if (
      !open ||
      !isProcessing ||
      !currentReport ||
      isProcessingCurrentRef.current
    )
      return;

    isProcessingCurrentRef.current = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, renderWaitMs));
      await exportReportAsPng({
        elementId,
        isDarkPreview,
        metadata: getMetadata(currentReport),
      });

      setCompletedCount((prev) => prev + 1);
      if (currentIndex < reports.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsProcessing(false);
        toast.success(t('ws-reports.export_png_success'));
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Bulk PNG export failed:', error);
      toast.error(t('ws-reports.failed_export_png'));
      setIsProcessing(false);
    } finally {
      isProcessingCurrentRef.current = false;
    }
  }, [
    currentIndex,
    currentReport,
    elementId,
    getMetadata,
    isDarkPreview,
    isProcessing,
    onOpenChange,
    open,
    renderWaitMs,
    reports.length,
    t,
  ]);

  useEffect(() => {
    if (open && reports.length > 0 && !isProcessing && completedCount === 0) {
      setIsProcessing(true);
    }
  }, [completedCount, isProcessing, open, reports.length]);

  useEffect(() => {
    if (isProcessing) {
      void processCurrentReport();
    }
  }, [isProcessing, processCurrentReport]);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const progress =
    reports.length > 0
      ? Math.round((completedCount / reports.length) * 100)
      : 0;

  return {
    currentReport,
    isProcessing,
    completedCount,
    progress,
  };
}
