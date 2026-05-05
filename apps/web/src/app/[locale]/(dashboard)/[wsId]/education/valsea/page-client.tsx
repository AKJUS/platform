'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  generateValseaClassroomArtifact,
  generateValseaClassroomScenario,
  getValseaClassroomConfig,
  type ValseaClassroomOutputType,
  type ValseaClassroomScenarioResponse,
  type ValseaPronunciationAssessorModel,
  validateValseaClassroomApiKey,
} from '@tuturuuu/internal-api';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ValseaKeyDialog } from './key-dialog';
import { EmptyState, PipelineStrip, ResultsGrid } from './result-panels';
import {
  HeroPanel,
  ScenarioConsole,
  StudioComposer,
  StudioNav,
} from './studio-layout';

const VALSEA_API_KEY_STORAGE_PREFIX = 'tuturuuu:valsea:valsea-api-key';

export function ValseaClassroomClient({ wsId }: { wsId: string }) {
  const t = useTranslations('workspace-education-tabs.valsea');
  const shellRef = useRef<HTMLDivElement>(null);
  const [transcript, setTranscript] = useState(() => t('sample_1_text'));
  const [language, setLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('vietnamese');
  const [outputType, setOutputType] =
    useState<ValseaClassroomOutputType>('action_items');
  const [pronunciationModel, setPronunciationModel] =
    useState<ValseaPronunciationAssessorModel>('local-whisper-large-v3-turbo');
  const [file, setFile] = useState<File | undefined>();
  const [draftApiKey, setDraftApiKey] = useState('');
  const [validatedApiKey, setValidatedApiKey] = useState('');
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [scenario, setScenario] =
    useState<ValseaClassroomScenarioResponse | null>(null);
  const apiKeyStorageKey = `${VALSEA_API_KEY_STORAGE_PREFIX}:${wsId}`;

  const configQuery = useQuery({
    queryFn: () => getValseaClassroomConfig(wsId),
    queryKey: ['valsea-classroom-config', wsId],
  });

  const hasApiKey =
    Boolean(validatedApiKey.trim()) || Boolean(configQuery.data?.hasServerKey);
  const canGenerate = file || transcript.trim().length > 0;

  const keyValidationMutation = useMutation({
    mutationFn: (key: string) => validateValseaClassroomApiKey(wsId, key),
    onSuccess: (_result, key) => {
      const normalizedKey = key.trim();
      setDraftApiKey(normalizedKey);
      setValidatedApiKey(normalizedKey);
      window.localStorage.setItem(apiKeyStorageKey, normalizedKey);
      setKeyDialogOpen(false);
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      generateValseaClassroomArtifact(wsId, {
        apiKey: validatedApiKey.trim() || undefined,
        file,
        language,
        outputType,
        pronunciationModel,
        targetLanguage,
        transcript: transcript.trim() || undefined,
      }),
    onError: (error) => {
      const message = error.message.toLowerCase();
      if (
        message.includes('valsea api key') ||
        message.includes('validation failed') ||
        message.includes('unauthorized')
      ) {
        setValidatedApiKey('');
        window.localStorage.removeItem(apiKeyStorageKey);
        setKeyDialogOpen(true);
      }
    },
  });

  const scenarioMutation = useMutation({
    mutationFn: () =>
      generateValseaClassroomScenario(wsId, {
        seed: `${Date.now()}-${outputType}-${targetLanguage}`,
      }),
    onSuccess: (nextScenario) => {
      setScenario(nextScenario);
      setTranscript(nextScenario.referencePhrase);
      setLanguage(nextScenario.sourceLanguage);
      setTargetLanguage(nextScenario.targetLanguage);
      setOutputType(nextScenario.outputType);
      setFile(undefined);
    },
  });

  useEffect(() => {
    const cachedKey = window.localStorage.getItem(apiKeyStorageKey)?.trim();
    if (cachedKey) {
      setDraftApiKey(cachedKey);
      setValidatedApiKey(cachedKey);
    }
  }, [apiKeyStorageKey]);

  useEffect(() => {
    if (
      configQuery.data &&
      !configQuery.data.hasServerKey &&
      !validatedApiKey.trim()
    ) {
      setKeyDialogOpen(true);
    }
  }, [configQuery.data, validatedApiKey]);

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
    if (draftApiKey.trim() && draftApiKey.trim() !== validatedApiKey.trim()) {
      setKeyDialogOpen(true);
      return;
    }

    if (!hasApiKey) {
      setKeyDialogOpen(true);
      return;
    }
    mutation.mutate();
  };

  const handleApiKeyChange = (value: string) => {
    setDraftApiKey(value);
    keyValidationMutation.reset();
    if (value.trim() !== validatedApiKey.trim()) {
      setValidatedApiKey('');
    }
  };

  const handleKeySubmit = () => {
    const trimmedKey = draftApiKey.trim();
    if (!trimmedKey) return;
    keyValidationMutation.mutate(trimmedKey);
  };

  return (
    <main
      ref={shellRef}
      className="w-full max-w-full overflow-x-hidden rounded-md border border-foreground/10 bg-background p-3 text-foreground sm:p-5"
    >
      <ValseaKeyDialog
        apiKey={draftApiKey}
        isValidating={keyValidationMutation.isPending}
        onApiKeyChange={handleApiKeyChange}
        onOpenChange={setKeyDialogOpen}
        onSubmit={handleKeySubmit}
        open={keyDialogOpen}
        t={t}
        validationError={keyValidationMutation.error?.message}
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
            apiKey={draftApiKey}
            file={file}
            isGenerating={mutation.isPending}
            isGeneratingScenario={scenarioMutation.isPending}
            language={language}
            onApiKeyChange={handleApiKeyChange}
            onFileChange={setFile}
            onGenerate={handleGenerate}
            onGenerateScenario={() => scenarioMutation.mutate()}
            onLanguageChange={setLanguage}
            onOutputTypeChange={(value) =>
              setOutputType(value as ValseaClassroomOutputType)
            }
            onPronunciationModelChange={(value) =>
              setPronunciationModel(value as ValseaPronunciationAssessorModel)
            }
            onTargetLanguageChange={setTargetLanguage}
            onTranscriptChange={setTranscript}
            outputType={outputType}
            pronunciationModel={pronunciationModel}
            targetLanguage={targetLanguage}
            t={t}
            transcript={transcript}
            canGenerate={Boolean(canGenerate)}
          />

          <div className="grid gap-5">
            <HeroPanel hasApiKey={hasApiKey} scenario={scenario} t={t} />
            <ScenarioConsole
              isGenerating={scenarioMutation.isPending}
              onGenerate={() => scenarioMutation.mutate()}
              scenario={scenario}
              t={t}
            />
            {scenarioMutation.error ? (
              <div className="valsea-reveal rounded-md border border-dynamic-red/25 bg-dynamic-red/10 p-4 text-dynamic-red text-sm">
                {scenarioMutation.error.message}
              </div>
            ) : null}
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
