'use client';

import { Brain, Trash2 } from '@tuturuuu/icons';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@tuturuuu/ui/dialog';
import { toast } from '@tuturuuu/ui/sonner';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import {
  useDeleteMiraMemory,
  useMiraMemories,
} from '../../../app/[locale]/(dashboard)/[wsId]/(dashboard)/hooks/use-mira-memories';

const CATEGORY_COLORS: Record<string, string> = {
  preference: 'bg-dynamic-blue/15 text-dynamic-blue',
  fact: 'bg-dynamic-green/15 text-dynamic-green',
  conversation_topic: 'bg-dynamic-purple/15 text-dynamic-purple',
  event: 'bg-dynamic-orange/15 text-dynamic-orange',
  person: 'bg-dynamic-pink/15 text-dynamic-pink',
};

export function MiraMemorySettings() {
  const t = useTranslations('settings.mira');
  const { data, isLoading } = useMiraMemories();
  const { mutate: deleteMemory, isPending: isDeleting } = useDeleteMiraMemory();

  const handleDelete = useCallback(
    (memoryId: string) => {
      deleteMemory(memoryId, {
        onSuccess: () => {
          toast.success(t('memory_deleted'));
        },
      });
    },
    [deleteMemory, t]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const grouped = data?.grouped ?? {};
  const categories = Object.keys(grouped).sort();

  if (!categories.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Brain className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="font-medium text-sm">{t('no_memories')}</p>
          <p className="mt-1 max-w-xs text-muted-foreground text-xs">
            {t('no_memories_description')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const memories = grouped[category] ?? [];
        return (
          <div key={category}>
            <div className="mb-3 flex items-center gap-2">
              <Badge
                variant="secondary"
                className={CATEGORY_COLORS[category] ?? ''}
              >
                {category.replace('_', ' ')}
              </Badge>
              <span className="text-muted-foreground text-xs">
                ({memories.length})
              </span>
            </div>
            <div className="space-y-2">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className="group flex items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{memory.key}</p>
                    <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                      {memory.value}
                    </p>
                    {memory.confidence < 1 && (
                      <p className="mt-1 text-muted-foreground/60 text-xs">
                        Confidence: {Math.round(memory.confidence * 100)}%
                      </p>
                    )}
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('delete_memory')}</DialogTitle>
                        <DialogDescription>
                          {t('delete_memory_confirm')}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="rounded-lg border p-3">
                        <p className="font-medium text-sm">{memory.key}</p>
                        <p className="mt-1 text-muted-foreground text-xs">
                          {memory.value}
                        </p>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline" size="sm">
                            Cancel
                          </Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(memory.id)}
                          >
                            {t('delete_memory')}
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
