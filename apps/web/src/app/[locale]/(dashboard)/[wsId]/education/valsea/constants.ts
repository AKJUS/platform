import type { ValseaClassroomOutputType } from '@tuturuuu/internal-api';

export type LanguageOption = {
  labelKey: string;
  value: string;
};

export type OutputOption = {
  labelKey: string;
  value: ValseaClassroomOutputType;
};

export const INPUT_LANGUAGES: LanguageOption[] = [
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

export const TARGET_LANGUAGES: LanguageOption[] = [
  { labelKey: 'language_vietnamese', value: 'vietnamese' },
  { labelKey: 'language_english', value: 'english' },
  { labelKey: 'language_chinese', value: 'chinese' },
  { labelKey: 'language_thai', value: 'thai' },
  { labelKey: 'language_filipino', value: 'filipino' },
  { labelKey: 'language_malay', value: 'malay' },
];

export const OUTPUT_TYPES: OutputOption[] = [
  { labelKey: 'output_action_items', value: 'action_items' },
  { labelKey: 'output_interview_notes', value: 'interview_notes' },
  { labelKey: 'output_key_quotes', value: 'key_quotes' },
  { labelKey: 'output_subtitles', value: 'subtitles' },
  { labelKey: 'output_email_summary', value: 'email_summary' },
  { labelKey: 'output_meeting_minutes', value: 'meeting_minutes' },
  { labelKey: 'output_service_log', value: 'service_log' },
];

export const SUGGESTED_PROMPTS = ['sample_1', 'sample_2', 'sample_3'] as const;

export const STUDIO_STEPS = [
  'pipeline_capture',
  'pipeline_grade',
  'pipeline_clarify',
  'pipeline_translate',
  'pipeline_understand',
  'pipeline_teach',
] as const;
