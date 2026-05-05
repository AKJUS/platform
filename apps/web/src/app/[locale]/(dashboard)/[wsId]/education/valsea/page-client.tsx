'use client';

import { useMutation } from '@tanstack/react-query';
import {
  BookOpen,
  Brain,
  FileAudio,
  Languages,
  Loader2,
  Sparkles,
  WandSparkles,
} from '@tuturuuu/icons';
import {
  generateValseaClassroomArtifact,
  type ValseaClassroomArtifactResponse,
  type ValseaClassroomOutputType,
} from '@tuturuuu/internal-api';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@tuturuuu/ui/card';
import { Input } from '@tuturuuu/ui/input';
import { Label } from '@tuturuuu/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tuturuuu/ui/select';
import { Textarea } from '@tuturuuu/ui/textarea';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type LanguageOption = {
  labelKey: string;
  value: string;
};

type OutputOption = {
  labelKey: string;
  value: ValseaClassroomOutputType;
};

const INPUT_LANGUAGES: LanguageOption[] = [
  { labelKey: 'language_auto', value: 'auto' },
  { labelKey: 'language_singlish', value: 'singlish' },
  { labelKey: 'language_vietnamese', value: 'vietnamese' },
  { labelKey: 'language_english', value: 'english' },
  { labelKey: 'language_filipino', value: 'filipino' },
  { labelKey: 'language_malay', value: 'malay' },
  { labelKey: 'language_thai', value: 'thai' },
  { labelKey: 'language_chinese', value: 'chinese' },
  { labelKey: 'language_tamil', value: 'tamil' },
];

const TARGET_LANGUAGES: LanguageOption[] = [
  { labelKey: 'language_vietnamese', value: 'vietnamese' },
  { labelKey: 'language_english', value: 'english' },
  { labelKey: 'language_chinese', value: 'chinese' },
  { labelKey: 'language_thai', value: 'thai' },
  { labelKey: 'language_filipino', value: 'filipino' },
  { labelKey: 'language_malay', value: 'malay' },
];

const OUTPUT_TYPES: OutputOption[] = [
  { labelKey: 'output_action_items', value: 'action_items' },
  { labelKey: 'output_interview_notes', value: 'interview_notes' },
  { labelKey: 'output_key_quotes', value: 'key_quotes' },
  { labelKey: 'output_subtitles', value: 'subtitles' },
  { labelKey: 'output_email_summary', value: 'email_summary' },
];

const SUGGESTED_PROMPTS = ['sample_1', 'sample_2', 'sample_3'] as const;

export function ValseaClassroomClient({ wsId }: { wsId: string }) {
  const t = useTranslations('workspace-education-tabs.valsea');
  const [transcript, setTranscript] = useState(() => t('sample_1_text'));
  const [language, setLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('vietnamese');
  const [outputType, setOutputType] =
    useState<ValseaClassroomOutputType>('action_items');
  const [file, setFile] = useState<File | undefined>();
  const [apiKey, setApiKey] = useState('');

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
  });

  const canGenerate = file || transcript.trim().length > 0;
  const result = mutation.data;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(320px,440px)_1fr]">
      <Card className="overflow-hidden border-dynamic-cyan/20 bg-dynamic-cyan/5">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-dynamic-cyan/25 bg-dynamic-cyan/10 text-dynamic-cyan hover:bg-dynamic-cyan/15">
              {t('badge')}
            </Badge>
            <Badge variant="secondary">{t('powered_by')}</Badge>
          </div>
          <div>
            <CardTitle className="text-2xl">{t('studio_title')}</CardTitle>
            <p className="mt-2 text-foreground/70 text-sm leading-6">
              {t('studio_description')}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="valsea-transcript">{t('transcript_label')}</Label>
            <Textarea
              id="valsea-transcript"
              className="min-h-48 resize-y bg-background/90 leading-6"
              onChange={(event) => setTranscript(event.target.value)}
              placeholder={t('transcript_placeholder')}
              value={transcript}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              id="valsea-source-language"
              label={t('source_language')}
              onValueChange={setLanguage}
              options={INPUT_LANGUAGES}
              t={t}
              value={language}
            />
            <SelectField
              id="valsea-target-language"
              label={t('target_language')}
              onValueChange={setTargetLanguage}
              options={TARGET_LANGUAGES}
              t={t}
              value={targetLanguage}
            />
          </div>

          <SelectField
            id="valsea-output-type"
            label={t('artifact_type')}
            onValueChange={(value) =>
              setOutputType(value as ValseaClassroomOutputType)
            }
            options={OUTPUT_TYPES}
            t={t}
            value={outputType}
          />

          <div className="space-y-2">
            <Label htmlFor="valsea-audio">{t('audio_label')}</Label>
            <Input
              accept="audio/mp3,audio/mpeg,audio/mp4,audio/m4a,audio/ogg,audio/wav,audio/webm,audio/flac"
              id="valsea-audio"
              onChange={(event) => setFile(event.target.files?.[0])}
              type="file"
            />
            <p className="text-foreground/60 text-xs">{t('audio_hint')}</p>
          </div>

          <div className="space-y-2 rounded-md border border-dynamic-green/20 bg-dynamic-green/5 p-3">
            <Label htmlFor="valsea-api-key">{t('byok_label')}</Label>
            <Input
              autoComplete="off"
              id="valsea-api-key"
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={t('byok_placeholder')}
              type="password"
              value={apiKey}
            />
            <p className="text-foreground/60 text-xs">{t('byok_hint')}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((key) => (
              <Button
                key={key}
                onClick={() => setTranscript(t(`${key}_text`))}
                size="sm"
                type="button"
                variant="outline"
              >
                {t(key)}
              </Button>
            ))}
          </div>

          {mutation.error ? (
            <div className="rounded-md border border-dynamic-red/25 bg-dynamic-red/10 p-3 text-dynamic-red text-sm">
              {mutation.error.message}
            </div>
          ) : null}

          <Button
            className="w-full gap-2"
            disabled={!canGenerate || mutation.isPending}
            onClick={() => mutation.mutate()}
            type="button"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <WandSparkles className="h-4 w-4" />
            )}
            {mutation.isPending ? t('generating') : t('generate')}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <PipelineStrip isLoading={mutation.isPending} t={t} />

        {result ? <ResultsGrid result={result} t={t} /> : <EmptyState t={t} />}
      </div>
    </div>
  );
}

function SelectField({
  id,
  label,
  onValueChange,
  options,
  t,
  value,
}: {
  id: string;
  label: string;
  onValueChange: (value: string) => void;
  options: Array<LanguageOption | OutputOption>;
  t: ReturnType<typeof useTranslations>;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger id={id} className="bg-background/90">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PipelineStrip({
  isLoading,
  t,
}: {
  isLoading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const steps = [
    { icon: FileAudio, label: t('pipeline_capture') },
    { icon: Sparkles, label: t('pipeline_clarify') },
    { icon: Languages, label: t('pipeline_translate') },
    { icon: Brain, label: t('pipeline_understand') },
    { icon: BookOpen, label: t('pipeline_teach') },
  ];

  return (
    <Card className="border-dynamic-green/20 bg-dynamic-green/5">
      <CardContent className="grid gap-3 p-4 md:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              className="flex min-h-20 items-center gap-3 rounded-md border border-foreground/10 bg-background/70 p-3"
              key={step.label}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dynamic-green/20 bg-dynamic-green/10 text-dynamic-green">
                {isLoading && index === 0 ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <span className="font-medium text-sm leading-5">
                {step.label}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ResultsGrid({
  result,
  t,
}: {
  result: ValseaClassroomArtifactResponse;
  t: ReturnType<typeof useTranslations>;
}) {
  const confidence = result.sentiment.confidence;
  const confidenceLabel =
    typeof confidence === 'number'
      ? `${Math.round(confidence * 100)}%`
      : t('not_available');

  const rawSummary = useMemo(
    () =>
      JSON.stringify(
        {
          annotations: result.annotations.raw,
          artifact: result.artifact.raw,
          clarification: result.clarification.raw,
          sentiment: result.sentiment.raw,
          translation: result.translation.raw,
        },
        null,
        2
      ),
    [result]
  );

  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      <ResultCard
        accent="cyan"
        content={result.clarification.text}
        eyebrow={t('clarified_eyebrow')}
        title={t('clarified_title')}
      />
      <ResultCard
        accent="green"
        content={result.translation.text || t('not_available')}
        eyebrow={result.translation.targetLanguage}
        title={t('translation_title')}
      />
      <ResultCard
        accent="orange"
        content={result.artifact.output}
        eyebrow={t(`output_${result.artifact.outputType}`)}
        title={t('artifact_title')}
      />

      <Card className="border-dynamic-pink/20 bg-dynamic-pink/5">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-dynamic-pink/25 bg-dynamic-pink/10 text-dynamic-pink hover:bg-dynamic-pink/15">
              {result.sentiment.sentiment || t('not_available')}
            </Badge>
            <Badge variant="secondary">{confidenceLabel}</Badge>
          </div>
          <CardTitle>{t('sentiment_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-foreground/75 text-sm leading-6">
            {result.sentiment.reasoning || t('not_available')}
          </p>
          {result.sentiment.emotions.length ? (
            <div className="flex flex-wrap gap-2">
              {result.sentiment.emotions.map((emotion) => (
                <Badge key={emotion} variant="outline">
                  {emotion}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-dynamic-blue/20 bg-dynamic-blue/5 2xl:col-span-2">
        <CardHeader>
          <CardTitle>{t('tags_title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {result.annotations.semanticTags.length ? (
            result.annotations.semanticTags.map((tag, index) => (
              <div
                className="rounded-md border border-foreground/10 bg-background/70 p-3"
                key={`${tag.phrase}-${tag.tag}-${index}`}
              >
                <div className="font-semibold text-sm">
                  {tag.phrase || tag.tag || t('tag')}
                </div>
                <div className="mt-1 text-foreground/65 text-xs">
                  {[tag.tag, tag.meaning].filter(Boolean).join(' · ') ||
                    t('not_available')}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-foreground/10 bg-background/70 p-3 text-foreground/65 text-sm md:col-span-2 xl:col-span-3">
              {t('no_tags')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-foreground/10 2xl:col-span-2">
        <CardHeader>
          <CardTitle>{t('raw_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-80 overflow-auto rounded-md border border-foreground/10 bg-foreground/5 p-4 text-xs leading-5">
            {rawSummary}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultCard({
  accent,
  content,
  eyebrow,
  title,
}: {
  accent: 'cyan' | 'green' | 'orange';
  content: string;
  eyebrow: string;
  title: string;
}) {
  const accentClasses = {
    cyan: 'border-dynamic-cyan/20 bg-dynamic-cyan/5 text-dynamic-cyan',
    green: 'border-dynamic-green/20 bg-dynamic-green/5 text-dynamic-green',
    orange: 'border-dynamic-orange/20 bg-dynamic-orange/5 text-dynamic-orange',
  }[accent];

  return (
    <Card className={accentClasses}>
      <CardHeader>
        <Badge className="w-fit border-current/20 bg-background/70 text-current hover:bg-background/80">
          {eyebrow}
        </Badge>
        <CardTitle className="text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-foreground/78 text-sm leading-6">
          {content}
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <Card className="min-h-96 border-dynamic-orange/20 bg-dynamic-orange/5">
      <CardContent className="flex min-h-96 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dynamic-orange/20 bg-dynamic-orange/10 text-dynamic-orange">
          <BookOpen className="h-6 w-6" />
        </div>
        <div className="max-w-lg">
          <h2 className="font-semibold text-xl">{t('empty_title')}</h2>
          <p className="mt-2 text-foreground/65 text-sm leading-6">
            {t('empty_description')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
