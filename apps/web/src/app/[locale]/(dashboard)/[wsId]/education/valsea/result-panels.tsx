'use client';

import {
  BookOpen,
  Brain,
  FileAudio,
  Languages,
  Loader2,
  Sparkles,
} from '@tuturuuu/icons';
import type {
  ValseaClassroomArtifactResponse,
  ValseaVoiceGradeLevel,
  ValseaVoiceGradeResult,
} from '@tuturuuu/internal-api';
import { Badge } from '@tuturuuu/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@tuturuuu/ui/card';
import type { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { STUDIO_STEPS } from './constants';

const STEP_ICONS = [
  FileAudio,
  Brain,
  Sparkles,
  Languages,
  Brain,
  BookOpen,
] as const;

export function PipelineStrip({
  hasApiKey,
  isLoading,
  t,
}: {
  hasApiKey: boolean;
  isLoading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card className="valsea-reveal overflow-hidden border-foreground/10 bg-foreground/4">
      <CardContent className="grid gap-0 p-0 md:grid-cols-3 xl:grid-cols-6">
        {STUDIO_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[index] ?? Sparkles;
          return (
            <div
              className="group min-h-28 border-foreground/10 border-b p-4 transition-colors duration-500 hover:bg-dynamic-green/8 md:border-r md:border-b-0 last:md:border-r-0"
              key={step}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-dynamic-green/20 bg-dynamic-green/10 text-dynamic-green transition-transform duration-700 ease-out group-hover:scale-105">
                  {isLoading && index === 0 ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <span className="font-mono text-foreground/35 text-xs">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="font-medium text-sm leading-5">{t(step)}</div>
            </div>
          );
        })}
      </CardContent>
      <div className="border-foreground/10 border-t px-4 py-3 text-foreground/60 text-xs">
        {hasApiKey ? t('key_state_ready') : t('key_state_missing')}
      </div>
    </Card>
  );
}

export function ResultsGrid({
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
          pronunciation: result.pronunciation?.raw,
          sentiment: result.sentiment.raw,
          translation: result.translation.raw,
        },
        null,
        2
      ),
    [result]
  );

  return (
    <div className="grid grid-flow-dense gap-4 lg:grid-cols-6">
      <ResultCard
        className="lg:col-span-3"
        content={result.clarification.text}
        eyebrow={t('clarified_eyebrow')}
        tone="green"
        title={t('clarified_title')}
      />
      <ResultCard
        className="lg:col-span-3"
        content={result.translation.text || t('not_available')}
        eyebrow={result.translation.targetLanguage}
        tone="cyan"
        title={t('translation_title')}
      />
      <ResultCard
        className="lg:col-span-4"
        content={result.artifact.output}
        eyebrow={t(`output_${result.artifact.outputType}`)}
        tone="orange"
        title={t('artifact_title')}
      />
      {result.pronunciation ? (
        <VoiceGradePanel grade={result.pronunciation} t={t} />
      ) : null}
      <Card className="valsea-stack-card border-dynamic-pink/20 bg-dynamic-pink/5 lg:col-span-2">
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

      <Card className="valsea-stack-card border-foreground/10 bg-foreground/4 lg:col-span-3">
        <CardHeader>
          <CardTitle>{t('tags_title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {result.annotations.semanticTags.length ? (
            result.annotations.semanticTags.slice(0, 6).map((tag, index) => (
              <div
                className="rounded-md border border-foreground/10 bg-background/70 p-3 transition-transform duration-700 ease-out hover:-translate-y-0.5"
                key={`${tag.phrase}-${tag.tag}-${index}`}
              >
                <div className="font-semibold text-sm">
                  {tag.phrase || tag.tag || t('tag')}
                </div>
                <div className="mt-1 text-foreground/65 text-xs">
                  {[tag.tag, tag.meaning].filter(Boolean).join(' / ') ||
                    t('not_available')}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-foreground/10 bg-background/70 p-3 text-foreground/65 text-sm">
              {t('no_tags')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="valsea-stack-card border-foreground/10 bg-foreground/4 lg:col-span-3">
        <CardHeader>
          <CardTitle>{t('raw_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <details className="group rounded-md border border-foreground/10 bg-background/70">
            <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 font-medium text-sm">
              <span>{t('raw_summary')}</span>
              <Badge variant="outline">{t('raw_collapsed')}</Badge>
            </summary>
            <pre className="max-h-80 overflow-auto border-foreground/10 border-t bg-foreground/5 p-4 text-xs leading-5">
              {rawSummary}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

function VoiceGradePanel({
  grade,
  t,
}: {
  grade: ValseaVoiceGradeResult;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card className="valsea-stack-card border-foreground/10 bg-foreground/4 lg:col-span-6">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={getGradeBadgeClasses(scoreToLevel(grade.overallScore))}
          >
            {t('voice_grade_overall')}: {grade.overallScore}%
          </Badge>
          <Badge
            className={getGradeBadgeClasses(
              scoreToLevel(grade.nativeSimilarity)
            )}
          >
            {t('voice_grade_native')}: {grade.nativeSimilarity}%
          </Badge>
          <Badge variant="outline">
            {grade.provider === 'local-model'
              ? t('voice_grade_provider_local')
              : t('voice_grade_provider_valsea')}
          </Badge>
          {grade.assessorModel ? (
            <Badge variant="outline">{grade.assessorModel}</Badge>
          ) : null}
        </div>
        <CardTitle>{t('voice_grade_title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-foreground/70 text-sm leading-6">{grade.summary}</p>

        <div className="grid gap-3 rounded-md border border-foreground/10 bg-background/70 p-4">
          <div className="font-mono text-foreground/45 text-xs uppercase tracking-[0.2em]">
            {t('voice_grade_reference')}
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-3 text-lg leading-8">
            {grade.words.map((word, wordIndex) => (
              <span
                className="inline-flex flex-wrap"
                key={`${word.expected}-${wordIndex}`}
              >
                {word.characters.map((character, characterIndex) => (
                  <span
                    className={`rounded px-0.5 ${getCharacterGradeClasses(character.level)}`}
                    key={`${character.character}-${characterIndex}`}
                    title={`${word.expected}: ${character.score}%`}
                  >
                    {character.character}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <TranscriptBox
            label={t('voice_grade_heard')}
            value={grade.heardText}
          />
          <TranscriptBox
            label={t('voice_grade_reference')}
            value={grade.referenceText}
          />
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {grade.words.map((word, index) => (
            <div
              className={`rounded-md border p-3 ${getWordGradeClasses(word.level)}`}
              key={`${word.expected}-${index}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm">{word.expected}</div>
                  <div className="mt-1 text-foreground/60 text-xs">
                    {word.heard || t('voice_grade_missing_word')}
                  </div>
                </div>
                <div className="font-mono text-sm">{word.score}%</div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded bg-background/80">
                <div
                  className={getGradeBarClasses(word.level)}
                  style={{ width: `${word.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TranscriptBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-foreground/10 bg-background/70 p-3">
      <div className="font-mono text-foreground/45 text-xs uppercase tracking-[0.2em]">
        {label}
      </div>
      <p className="mt-2 text-foreground/75 text-sm leading-6">{value}</p>
    </div>
  );
}

function scoreToLevel(score: number): ValseaVoiceGradeLevel {
  if (score >= 85) return 'green';
  if (score >= 70) return 'amber';
  if (score >= 50) return 'orange';
  return 'red';
}

function getGradeBadgeClasses(level: ValseaVoiceGradeLevel) {
  const classes = {
    amber:
      'border-dynamic-yellow/25 bg-dynamic-yellow/10 text-dynamic-yellow hover:bg-dynamic-yellow/15',
    green:
      'border-dynamic-green/25 bg-dynamic-green/10 text-dynamic-green hover:bg-dynamic-green/15',
    orange:
      'border-dynamic-orange/25 bg-dynamic-orange/10 text-dynamic-orange hover:bg-dynamic-orange/15',
    red: 'border-dynamic-red/25 bg-dynamic-red/10 text-dynamic-red hover:bg-dynamic-red/15',
  };

  return classes[level];
}

function getCharacterGradeClasses(level: ValseaVoiceGradeLevel) {
  const classes = {
    amber: 'bg-dynamic-yellow/15 text-dynamic-yellow',
    green: 'bg-dynamic-green/15 text-dynamic-green',
    orange: 'bg-dynamic-orange/15 text-dynamic-orange',
    red: 'bg-dynamic-red/15 text-dynamic-red',
  };

  return classes[level];
}

function getWordGradeClasses(level: ValseaVoiceGradeLevel) {
  const classes = {
    amber: 'border-dynamic-yellow/20 bg-dynamic-yellow/5',
    green: 'border-dynamic-green/20 bg-dynamic-green/5',
    orange: 'border-dynamic-orange/20 bg-dynamic-orange/5',
    red: 'border-dynamic-red/20 bg-dynamic-red/5',
  };

  return classes[level];
}

function getGradeBarClasses(level: ValseaVoiceGradeLevel) {
  const classes = {
    amber: 'h-full rounded bg-dynamic-yellow',
    green: 'h-full rounded bg-dynamic-green',
    orange: 'h-full rounded bg-dynamic-orange',
    red: 'h-full rounded bg-dynamic-red',
  };

  return classes[level];
}

export function EmptyState({
  hasApiKey,
  onOpenKeyDialog,
  t,
}: {
  hasApiKey: boolean;
  onOpenKeyDialog: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card className="valsea-reveal min-h-96 overflow-hidden border-dynamic-orange/20 bg-dynamic-orange/5">
      <CardContent className="grid min-h-96 gap-8 p-8 md:grid-cols-[1fr_0.75fr] md:items-center">
        <div className="max-w-xl">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-md border border-dynamic-orange/20 bg-dynamic-orange/10 text-dynamic-orange">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="font-semibold text-3xl tracking-tight">
            {hasApiKey ? t('empty_title') : t('empty_key_title')}
          </h2>
          <p className="mt-4 text-foreground/65 text-sm leading-6">
            {hasApiKey ? t('empty_description') : t('empty_key_description')}
          </p>
        </div>
        <button
          className="group grid min-h-56 rounded-md border border-dynamic-orange/25 bg-background/60 p-4 text-left transition-transform duration-700 ease-out hover:-translate-y-1 hover:bg-background"
          onClick={onOpenKeyDialog}
          type="button"
        >
          <div className="self-start font-mono text-dynamic-orange text-xs uppercase tracking-[0.22em]">
            {t('key_dialog_title')}
          </div>
          <div className="self-end">
            <div className="font-semibold text-xl">{t('key_dialog_save')}</div>
            <p className="mt-2 text-foreground/60 text-sm leading-6">
              {t('key_dialog_hint')}
            </p>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

function ResultCard({
  className,
  content,
  eyebrow,
  title,
  tone,
}: {
  className?: string;
  content: string;
  eyebrow: string;
  title: string;
  tone: 'cyan' | 'green' | 'orange';
}) {
  const toneClasses = {
    cyan: 'border-dynamic-cyan/20 bg-dynamic-cyan/5 text-dynamic-cyan',
    green: 'border-dynamic-green/20 bg-dynamic-green/5 text-dynamic-green',
    orange: 'border-dynamic-orange/20 bg-dynamic-orange/5 text-dynamic-orange',
  }[tone];

  return (
    <Card className={`valsea-stack-card ${toneClasses} ${className ?? ''}`}>
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
