import 'server-only';

import { serverLogger } from '@/lib/infrastructure/log-drain';

type ValseaRecord = Record<string, unknown>;

export type VoiceGradeLevel = 'amber' | 'green' | 'orange' | 'red';

export interface VoiceGradeCharacter {
  character: string;
  level: VoiceGradeLevel;
  score: number;
}

export interface VoiceGradeWord {
  characters: VoiceGradeCharacter[];
  expected: string;
  heard: string;
  level: VoiceGradeLevel;
  nativeScore: number;
  score: number;
}

export interface VoiceGradeResult {
  heardText: string;
  nativeSimilarity: number;
  overallScore: number;
  provider: 'local-model' | 'valsea-heuristic';
  raw?: unknown;
  referenceText: string;
  summary: string;
  words: VoiceGradeWord[];
}

interface GradeVoiceInput {
  file: File;
  language: string;
  referenceText: string;
  transcription: ValseaRecord | null;
}

function getString(record: ValseaRecord | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumber(record: ValseaRecord | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function getRecordArray(record: ValseaRecord | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is ValseaRecord =>
          !!entry && typeof entry === 'object' && !Array.isArray(entry)
      )
    : [];
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreToLevel(score: number): VoiceGradeLevel {
  if (score >= 85) return 'green';
  if (score >= 70) return 'amber';
  if (score >= 50) return 'orange';
  return 'red';
}

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

function tokenizeWords(value: string) {
  return value.match(/\S+/g) ?? [];
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index
  );
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const deletionCost = (current[rightIndex - 1] ?? 0) + 1;
      const insertionCost = (previous[rightIndex] ?? 0) + 1;
      const substitutionDistance =
        (previous[rightIndex - 1] ?? 0) + substitutionCost;
      current[rightIndex] = Math.min(
        deletionCost,
        insertionCost,
        substitutionDistance
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index] ?? 0;
    }
  }

  return previous[right.length] ?? 0;
}

function compareTokens(expected: string, heard: string) {
  const normalizedExpected = normalizeToken(expected);
  const normalizedHeard = normalizeToken(heard);
  const maxLength = Math.max(normalizedExpected.length, normalizedHeard.length);
  if (maxLength === 0) return 100;

  const distance = levenshteinDistance(normalizedExpected, normalizedHeard);
  return clampScore((1 - distance / maxLength) * 100);
}

function buildCharacterGrades(
  expected: string,
  heard: string,
  wordScore: number
) {
  const normalizedHeard = normalizeToken(heard);
  let heardIndex = 0;

  return [...expected].map<VoiceGradeCharacter>((character) => {
    const normalizedCharacter = normalizeToken(character);
    if (!normalizedCharacter) {
      return { character, level: 'green', score: 100 };
    }

    const heardCharacter = normalizedHeard[heardIndex] ?? '';
    heardIndex += 1;
    const score =
      normalizedCharacter === heardCharacter
        ? Math.max(wordScore, 88)
        : Math.max(0, wordScore - 25);

    return {
      character,
      level: scoreToLevel(score),
      score: clampScore(score),
    };
  });
}

function buildHeuristicGrade(input: GradeVoiceInput): VoiceGradeResult {
  const heardText =
    getString(input.transcription ?? undefined, 'raw_transcript') ||
    getString(input.transcription ?? undefined, 'text') ||
    '';
  const expectedWords = tokenizeWords(input.referenceText);
  const heardWords = tokenizeWords(heardText);
  const corrections = Array.isArray(input.transcription?.corrections)
    ? input.transcription.corrections.length
    : 0;
  const correctionPenalty = Math.min(18, corrections * 3);

  const words = expectedWords.map<VoiceGradeWord>((expected, index) => {
    const heard = heardWords[index] ?? '';
    const score = compareTokens(expected, heard);
    const nativeScore = clampScore(score - correctionPenalty);

    return {
      characters: buildCharacterGrades(expected, heard, score),
      expected,
      heard,
      level: scoreToLevel(score),
      nativeScore,
      score,
    };
  });

  const average =
    words.length > 0
      ? words.reduce((total, word) => total + word.score, 0) / words.length
      : 0;
  const nativeAverage =
    words.length > 0
      ? words.reduce((total, word) => total + word.nativeScore, 0) /
        words.length
      : 0;
  const overallScore = clampScore(average);
  const nativeSimilarity = clampScore(nativeAverage);

  return {
    heardText,
    nativeSimilarity,
    overallScore,
    provider: 'valsea-heuristic',
    raw: input.transcription,
    referenceText: input.referenceText,
    summary:
      nativeSimilarity >= 85
        ? 'Native-like delivery with only minor classroom-level differences.'
        : nativeSimilarity >= 70
          ? 'Understandable delivery with a few sounds to tighten.'
          : nativeSimilarity >= 50
            ? 'Partly understandable, but several words need another pass.'
            : 'Needs focused pronunciation practice before using this phrase live.',
    words,
  };
}

function normalizeExternalWord(entry: ValseaRecord): VoiceGradeWord | null {
  const expected = getString(entry, 'expected');
  if (!expected) return null;

  const heard = getString(entry, 'heard') || '';
  const score = clampScore(
    getNumber(entry, 'score') ?? compareTokens(expected, heard)
  );
  const nativeScore = clampScore(getNumber(entry, 'nativeScore') ?? score);
  const characters = getRecordArray(entry, 'characters').map((character) => {
    const rawScore = clampScore(getNumber(character, 'score') ?? score);
    return {
      character: getString(character, 'character') || '',
      level: scoreToLevel(rawScore),
      score: rawScore,
    };
  });

  return {
    characters: characters.length
      ? characters
      : buildCharacterGrades(expected, heard, score),
    expected,
    heard,
    level: scoreToLevel(score),
    nativeScore,
    score,
  };
}

function normalizeExternalGrade(
  data: ValseaRecord,
  fallback: VoiceGradeResult
): VoiceGradeResult {
  const words = getRecordArray(data, 'words')
    .map(normalizeExternalWord)
    .filter((entry): entry is VoiceGradeWord => Boolean(entry));

  return {
    heardText: getString(data, 'heardText') || fallback.heardText,
    nativeSimilarity: clampScore(
      getNumber(data, 'nativeSimilarity') ?? fallback.nativeSimilarity
    ),
    overallScore: clampScore(
      getNumber(data, 'overallScore') ?? fallback.overallScore
    ),
    provider: 'local-model',
    raw: data,
    referenceText: getString(data, 'referenceText') || fallback.referenceText,
    summary: getString(data, 'summary') || fallback.summary,
    words: words.length ? words : fallback.words,
  };
}

async function gradeWithLocalModel(
  input: GradeVoiceInput,
  fallback: VoiceGradeResult
) {
  const endpoint = process.env.VALSEA_PRONUNCIATION_ASSESSOR_URL?.trim();
  if (!endpoint) return null;

  try {
    const formData = new FormData();
    formData.set('file', input.file, input.file.name);
    formData.set('language', input.language);
    formData.set('referenceText', input.referenceText);
    formData.set('valseaTranscript', fallback.heardText);
    formData.set('valseaResponse', JSON.stringify(input.transcription ?? {}));

    const response = await fetch(endpoint, {
      body: formData,
      cache: 'no-store',
      method: 'POST',
    });

    if (!response.ok) {
      serverLogger.warn('Local pronunciation assessor failed', {
        status: response.status,
      });
      return null;
    }

    const data = (await response.json()) as ValseaRecord;
    return normalizeExternalGrade(data, fallback);
  } catch (error) {
    serverLogger.warn('Local pronunciation assessor unavailable', error);
    return null;
  }
}

export async function gradeVoicePronunciation(input: GradeVoiceInput) {
  const fallback = buildHeuristicGrade(input);
  return (await gradeWithLocalModel(input, fallback)) ?? fallback;
}
