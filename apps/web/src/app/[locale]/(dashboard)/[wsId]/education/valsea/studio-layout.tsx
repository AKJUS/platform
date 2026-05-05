'use client';

import {
  BookOpen,
  Brain,
  FileAudio,
  KeyRound,
  Languages,
  Loader2,
  Sparkles,
  WandSparkles,
} from '@tuturuuu/icons';
import type {
  ValseaClassroomOutputType,
  ValseaClassroomScenarioResponse,
} from '@tuturuuu/internal-api';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import { Card, CardContent } from '@tuturuuu/ui/card';
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
import type { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  INPUT_LANGUAGES,
  type LanguageOption,
  OUTPUT_TYPES,
  type OutputOption,
  SUGGESTED_PROMPTS,
  TARGET_LANGUAGES,
} from './constants';

export function StudioNav({
  hasApiKey,
  isConfigLoading,
  onOpenKeyDialog,
  t,
}: {
  hasApiKey: boolean;
  isConfigLoading: boolean;
  onOpenKeyDialog: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="valsea-reveal flex flex-col gap-3 rounded-md border border-foreground/10 bg-background/80 p-2 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background">
          <Languages className="h-4 w-4" />
        </span>
        <span className="font-semibold">{t('nav_title')}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={hasApiKey ? 'secondary' : 'outline'}>
          {isConfigLoading
            ? t('key_state_checking')
            : hasApiKey
              ? t('key_state_ready')
              : t('key_state_missing')}
        </Badge>
        <Button
          className="min-h-11 rounded-md"
          onClick={onOpenKeyDialog}
          size="sm"
          variant={hasApiKey ? 'outline' : 'default'}
        >
          <KeyRound className="h-4 w-4" />
          {hasApiKey ? t('key_dialog_change') : t('key_dialog_save')}
        </Button>
      </div>
    </div>
  );
}

export function HeroPanel({
  hasApiKey,
  scenario,
  t,
}: {
  hasApiKey: boolean;
  scenario: ValseaClassroomScenarioResponse | null;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <section className="valsea-reveal grid gap-6 rounded-md border border-foreground/10 bg-background/70 p-6 backdrop-blur md:grid-cols-[1fr_18rem] md:p-8">
      <div className="max-w-5xl">
        <h1 className="text-[clamp(2.6rem,5vw,5.75rem)] leading-[0.95] tracking-tight">
          {t('hero_title_before')}{' '}
          <span
            aria-hidden
            className="inline-block h-[0.72em] w-[1.55em] rounded-md bg-center bg-cover align-middle contrast-125 grayscale"
            style={{
              backgroundImage:
                'url(https://picsum.photos/seed/valsea-classroom/480/240)',
            }}
          />{' '}
          {t('hero_title_after')}
        </h1>
        <p className="mt-5 max-w-2xl text-base text-foreground/66 leading-7">
          {t('hero_description')}
        </p>
      </div>
      <div className="grid content-between rounded-md border border-dynamic-green/20 bg-dynamic-green/8 p-5">
        <div>
          <div className="font-mono text-dynamic-green text-xs uppercase tracking-[0.24em]">
            {t('provider_signal')}
          </div>
          <div className="mt-3 font-semibold text-2xl">
            {scenario?.title ??
              (hasApiKey ? t('key_state_ready') : t('key_state_missing'))}
          </div>
          {scenario ? (
            <p className="mt-3 text-foreground/65 text-sm leading-6">
              {scenario.teacherGoal}
            </p>
          ) : null}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-background/80 p-3">
            <FileAudio className="mb-3 h-4 w-4 text-dynamic-green" />
            {t('signal_audio')}
          </div>
          <div className="rounded-md bg-background/80 p-3">
            <Sparkles className="mb-3 h-4 w-4 text-dynamic-green" />
            {t('signal_text')}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ScenarioConsole({
  isGenerating,
  onGenerate,
  scenario,
  t,
}: {
  isGenerating: boolean;
  onGenerate: () => void;
  scenario: ValseaClassroomScenarioResponse | null;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card className="valsea-reveal overflow-hidden border-dynamic-cyan/20 bg-dynamic-cyan/5">
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr] lg:p-6">
        <div>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-dynamic-cyan/25 bg-dynamic-cyan/10 text-dynamic-cyan">
            <Brain className="h-5 w-5" />
          </div>
          <h2 className="font-semibold text-2xl tracking-tight">
            {t('scenario_console_title')}
          </h2>
          <p className="mt-3 text-foreground/66 text-sm leading-6">
            {t('scenario_console_description')}
          </p>
          <Button
            className="mt-5 min-h-11 gap-2"
            disabled={isGenerating}
            onClick={onGenerate}
            type="button"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? t('scenario_generating') : t('scenario_generate')}
          </Button>
        </div>

        <div className="grid gap-3">
          {scenario ? (
            <>
              <div className="rounded-md border border-foreground/10 bg-background/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {scenario.scenarioTags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 font-semibold text-xl">
                  {scenario.title}
                </div>
                <p className="mt-2 text-foreground/68 text-sm leading-6">
                  {scenario.classroomContext}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <ScenarioMiniCard
                  icon={<Languages className="h-4 w-4" />}
                  label={t('scenario_learner')}
                  value={scenario.learnerPersona}
                />
                <ScenarioMiniCard
                  icon={<BookOpen className="h-4 w-4" />}
                  label={t('scenario_rubric')}
                  value={scenario.rubric.join(' / ')}
                />
              </div>
            </>
          ) : (
            <div className="grid min-h-52 place-items-center rounded-md border border-foreground/10 bg-background/60 p-6 text-center">
              <div>
                <Sparkles className="mx-auto mb-4 h-6 w-6 text-dynamic-cyan" />
                <p className="text-foreground/65 text-sm leading-6">
                  {t('scenario_empty')}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScenarioMiniCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-foreground/10 bg-background/70 p-3">
      <div className="flex items-center gap-2 font-mono text-foreground/45 text-xs uppercase tracking-[0.18em]">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-foreground/72 text-sm leading-6">{value}</p>
    </div>
  );
}

export function StudioComposer({
  apiKey,
  canGenerate,
  file,
  isGenerating,
  isGeneratingScenario,
  language,
  onApiKeyChange,
  onFileChange,
  onGenerate,
  onGenerateScenario,
  onLanguageChange,
  onOutputTypeChange,
  onTargetLanguageChange,
  onTranscriptChange,
  outputType,
  targetLanguage,
  t,
  transcript,
}: {
  apiKey: string;
  canGenerate: boolean;
  file?: File;
  isGenerating: boolean;
  isGeneratingScenario: boolean;
  language: string;
  onApiKeyChange: (value: string) => void;
  onFileChange: (value: File | undefined) => void;
  onGenerate: () => void;
  onGenerateScenario: () => void;
  onLanguageChange: (value: string) => void;
  onOutputTypeChange: (value: string) => void;
  onTargetLanguageChange: (value: string) => void;
  onTranscriptChange: (value: string) => void;
  outputType: ValseaClassroomOutputType;
  targetLanguage: string;
  t: ReturnType<typeof useTranslations>;
  transcript: string;
}) {
  return (
    <Card className="valsea-reveal overflow-hidden border-foreground/10 bg-background/80 backdrop-blur">
      <CardContent className="space-y-6 p-5 md:p-6">
        <div>
          <h2 className="text-2xl tracking-tight">{t('composer_title')}</h2>
          <p className="mt-2 text-foreground/60 text-sm leading-6">
            {t('composer_description')}
          </p>
        </div>

        <Button
          className="min-h-11 w-full gap-2 border-dynamic-cyan/25 bg-dynamic-cyan/10 text-dynamic-cyan hover:bg-dynamic-cyan/15"
          disabled={isGeneratingScenario}
          onClick={onGenerateScenario}
          type="button"
          variant="outline"
        >
          {isGeneratingScenario ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {isGeneratingScenario
            ? t('scenario_generating')
            : t('scenario_generate_short')}
        </Button>

        <div className="space-y-2">
          <Label htmlFor="valsea-transcript">{t('transcript_label')}</Label>
          <Textarea
            id="valsea-transcript"
            className="min-h-52 resize-y border-foreground/10 bg-foreground/4 text-base leading-7"
            onChange={(event) => onTranscriptChange(event.target.value)}
            placeholder={t('transcript_placeholder')}
            value={transcript}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            id="valsea-source-language"
            label={t('source_language')}
            onValueChange={onLanguageChange}
            options={INPUT_LANGUAGES}
            t={t}
            value={language}
          />
          <SelectField
            id="valsea-target-language"
            label={t('target_language')}
            onValueChange={onTargetLanguageChange}
            options={TARGET_LANGUAGES}
            t={t}
            value={targetLanguage}
          />
        </div>

        <SelectField
          id="valsea-output-type"
          label={t('artifact_type')}
          onValueChange={onOutputTypeChange}
          options={OUTPUT_TYPES}
          t={t}
          value={outputType}
        />

        <div className="grid gap-3 sm:grid-cols-[1fr_0.8fr]">
          <div className="space-y-2">
            <Label htmlFor="valsea-audio">{t('audio_label')}</Label>
            <Input
              accept="audio/mp3,audio/mpeg,audio/mp4,audio/m4a,audio/ogg,audio/wav,audio/webm,audio/flac"
              id="valsea-audio"
              onChange={(event) => onFileChange(event.target.files?.[0])}
              type="file"
            />
            <p className="text-foreground/60 text-xs">
              {file ? file.name : t('audio_hint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valsea-api-key">{t('byok_label')}</Label>
            <Input
              autoComplete="off"
              id="valsea-api-key"
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder={t('byok_placeholder')}
              type="password"
              value={apiKey}
            />
            <p className="text-foreground/60 text-xs">{t('byok_short_hint')}</p>
          </div>
        </div>

        <div className="grid grid-flow-dense gap-2 sm:grid-cols-6">
          {SUGGESTED_PROMPTS.map((key) => (
            <Button
              className="sm:col-span-3"
              key={key}
              onClick={() => onTranscriptChange(t(`${key}_text`))}
              type="button"
              variant="outline"
            >
              {t(key)}
            </Button>
          ))}
        </div>

        <Button
          className="min-h-12 w-full gap-2 text-base"
          disabled={!canGenerate || isGenerating}
          onClick={onGenerate}
          type="button"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <WandSparkles className="h-4 w-4" />
          )}
          {isGenerating ? t('generating') : t('generate')}
        </Button>
      </CardContent>
    </Card>
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
        <SelectTrigger id={id} className="min-h-11 bg-foreground/4">
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
