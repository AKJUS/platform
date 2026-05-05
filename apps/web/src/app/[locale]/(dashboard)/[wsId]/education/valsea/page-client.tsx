'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  generateValseaClassroomArtifact,
  getValseaClassroomConfig,
  type ValseaClassroomOutputType,
} from '@tuturuuu/internal-api';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ValseaKeyDialog } from './key-dialog';
import { EmptyState, PipelineStrip, ResultsGrid } from './result-panels';
import { HeroPanel, StudioComposer, StudioNav } from './studio-layout';

export function ValseaClassroomClient({ wsId }: { wsId: string }) {
  const t = useTranslations('workspace-education-tabs.valsea');
  const shellRef = useRef<HTMLDivElement>(null);
  const [transcript, setTranscript] = useState(() => t('sample_1_text'));
  const [language, setLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('vietnamese');
  const [outputType, setOutputType] =
    useState<ValseaClassroomOutputType>('action_items');
  const [file, setFile] = useState<File | undefined>();
  const [apiKey, setApiKey] = useState('');
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);

  const configQuery = useQuery({
    queryFn: () => getValseaClassroomConfig(wsId),
    queryKey: ['valsea-classroom-config', wsId],
  });

  const hasApiKey =
    Boolean(apiKey.trim()) || Boolean(configQuery.data?.hasServerKey);
  const canGenerate = file || transcript.trim().length > 0;

  const mutation = useMutation({
    mutationFn: () =>
      generateValseaClassroomArtifact(wsId, {
        apiKey: apiKey.trim() || undefined,
        file,
        language,
        outputType,
        targetLanguage,
        transcript: transcript.trim() || undefined,
      }),
    onError: (error) => {
      if (error.message.toLowerCase().includes('valsea api key')) {
        setKeyDialogOpen(true);
      }
    },
  });

  useEffect(() => {
    if (configQuery.data && !configQuery.data.hasServerKey && !apiKey.trim()) {
      setKeyDialogOpen(true);
    }
  }, [apiKey, configQuery.data]);

  useEffect(() => {
    let context: { revert: () => void } | undefined;

    void import('@tuturuuu/ui/gsap').then(({ ScrollTrigger, gsap }) => {
      if (!shellRef.current) return;
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        gsap.fromTo(
          '.valsea-reveal',
          { opacity: 0, y: 24 },
          {
            duration: 0.7,
            ease: 'power3.out',
            opacity: 1,
            stagger: 0.08,
            y: 0,
          }
        );

        gsap.utils
          .toArray<HTMLElement>('.valsea-stack-card')
          .forEach((card) => {
            gsap.fromTo(
              card,
              { opacity: 0.72, scale: 0.96, y: 24 },
              {
                ease: 'none',
                opacity: 1,
                scale: 1,
                scrollTrigger: {
                  end: 'top 45%',
                  scrub: 0.7,
                  start: 'top 92%',
                  trigger: card,
                },
                y: 0,
              }
            );
          });
      }, shellRef);
    });

    return () => context?.revert();
  }, []);

  const handleGenerate = () => {
    if (!hasApiKey) {
      setKeyDialogOpen(true);
      return;
    }
    mutation.mutate();
  };

  const handleKeySubmit = () => {
    if (!apiKey.trim()) return;
    setKeyDialogOpen(false);
  };

  return (
    <main
      ref={shellRef}
      className="w-full max-w-full overflow-x-hidden rounded-md border border-foreground/10 bg-background p-3 text-foreground sm:p-5"
    >
      <ValseaKeyDialog
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        onOpenChange={setKeyDialogOpen}
        onSubmit={handleKeySubmit}
        open={keyDialogOpen}
        t={t}
      />

      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <StudioNav
          hasApiKey={hasApiKey}
          isConfigLoading={configQuery.isLoading}
          onOpenKeyDialog={() => setKeyDialogOpen(true)}
          t={t}
        />

        <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.82fr)_1.18fr]">
          <StudioComposer
            apiKey={apiKey}
            file={file}
            isGenerating={mutation.isPending}
            language={language}
            onApiKeyChange={setApiKey}
            onFileChange={setFile}
            onGenerate={handleGenerate}
            onLanguageChange={setLanguage}
            onOutputTypeChange={(value) =>
              setOutputType(value as ValseaClassroomOutputType)
            }
            onTargetLanguageChange={setTargetLanguage}
            onTranscriptChange={setTranscript}
            outputType={outputType}
            targetLanguage={targetLanguage}
            t={t}
            transcript={transcript}
            canGenerate={Boolean(canGenerate)}
          />

          <div className="grid gap-5">
            <HeroPanel hasApiKey={hasApiKey} t={t} />
            <PipelineStrip
              hasApiKey={hasApiKey}
              isLoading={mutation.isPending}
              t={t}
            />
            {mutation.error ? (
              <div className="valsea-reveal rounded-md border border-dynamic-red/25 bg-dynamic-red/10 p-4 text-dynamic-red text-sm">
                {mutation.error.message}
              </div>
            ) : null}
            {mutation.data ? (
              <ResultsGrid result={mutation.data} t={t} />
            ) : (
              <EmptyState
                hasApiKey={hasApiKey}
                onOpenKeyDialog={() => setKeyDialogOpen(true)}
                t={t}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
