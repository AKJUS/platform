import { google } from '@ai-sdk/google';
import { resolveWorkspaceId } from '@tuturuuu/utils/constants';
import { verifyWorkspaceMembershipType } from '@tuturuuu/utils/workspace-helper';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { type AuthorizedRequest, withSessionAuth } from '@/lib/api-auth';
import { serverLogger } from '@/lib/infrastructure/log-drain';

type Params = {
  wsId: string;
};

const ScenarioRequestSchema = z.object({
  mode: z
    .enum(['parent_update', 'pronunciation_lab', 'regional_classroom'])
    .optional(),
  seed: z.string().trim().max(120).optional(),
});

const ScenarioSchema = z.object({
  classroomContext: z.string().min(12).max(420),
  expectedConfusions: z.array(z.string().min(2).max(120)).min(2).max(5),
  learnerPersona: z.string().min(8).max(180),
  outputType: z.enum([
    'action_items',
    'email_summary',
    'interview_notes',
    'key_quotes',
    'meeting_minutes',
    'service_log',
    'subtitles',
  ]),
  referencePhrase: z.string().min(12).max(700),
  rubric: z.array(z.string().min(8).max(160)).min(3).max(5),
  scenarioTags: z.array(z.string().min(2).max(32)).min(3).max(7),
  sourceLanguage: z.enum([
    'auto',
    'chinese',
    'english',
    'filipino',
    'malay',
    'singlish',
    'tamil',
    'thai',
    'vietnamese',
  ]),
  targetLanguage: z.enum([
    'chinese',
    'english',
    'filipino',
    'malay',
    'thai',
    'vietnamese',
  ]),
  teacherGoal: z.string().min(8).max(180),
  title: z.string().min(6).max(80),
});

const FALLBACK_SCENARIOS: z.infer<typeof ScenarioSchema>[] = [
  {
    classroomContext:
      'A mixed English and Vietnamese IELTS class is practicing inference questions after a short reading passage.',
    expectedConfusions: [
      'infer versus guess',
      'context clue wording',
      'final consonant clarity',
    ],
    learnerPersona:
      'An intermediate Vietnamese learner who understands the lesson but sounds hesitant when explaining evidence.',
    outputType: 'action_items',
    referencePhrase:
      'I can infer the writer is worried because the paragraph says the river level kept rising overnight.',
    rubric: [
      'Check whether infer is pronounced clearly.',
      'Listen for final consonants in writer, kept, and overnight.',
      'Give the learner one short repair drill.',
    ],
    scenarioTags: ['IELTS', 'Vietnamese learner', 'pronunciation lab'],
    sourceLanguage: 'english',
    targetLanguage: 'vietnamese',
    teacherGoal:
      'Turn the learner voice note into a pronunciation-aware micro practice plan.',
    title: 'Inference answer rescue',
  },
  {
    classroomContext:
      'A Singapore secondary math class is comparing two linear graphs and the teacher wants parent-safe follow-up notes.',
    expectedConfusions: [
      'slope versus intercept',
      'Singlish filler words',
      'graph comparison phrasing',
    ],
    learnerPersona:
      'A confident SEA learner who code-switches when the concept becomes abstract.',
    outputType: 'email_summary',
    referencePhrase:
      'I can compare the two graphs by checking which line has a steeper slope and a higher y-intercept.',
    rubric: [
      'Identify whether slope and intercept are said distinctly.',
      'Separate conceptual confusion from pronunciation friction.',
      'Generate a parent-friendly follow-up.',
    ],
    scenarioTags: ['Singapore', 'math', 'parent update'],
    sourceLanguage: 'singlish',
    targetLanguage: 'english',
    teacherGoal:
      'Create a concise home update and a next-step practice prompt.',
    title: 'Slope and intercept check-in',
  },
  {
    classroomContext:
      'A Filipino coding club is preparing students to explain recursion during a short oral demo.',
    expectedConfusions: [
      'recursive call wording',
      'base case stress',
      'technical vocabulary confidence',
    ],
    learnerPersona:
      'A beginner programmer who can run the code but struggles to explain the algorithm aloud.',
    outputType: 'interview_notes',
    referencePhrase:
      'The function calls itself with a smaller input until it reaches the base case.',
    rubric: [
      'Grade clarity on function, smaller, and base case.',
      'Detect whether the explanation is memorized or understood.',
      'Produce coaching notes for the next oral demo.',
    ],
    scenarioTags: ['coding', 'Filipino learner', 'oral demo'],
    sourceLanguage: 'english',
    targetLanguage: 'filipino',
    teacherGoal: 'Prepare interview-style notes and a spoken rehearsal plan.',
    title: 'Recursion oral demo',
  },
];

async function verifyAccess(context: AuthorizedRequest, wsId: string) {
  const resolvedWsId = resolveWorkspaceId(wsId);
  const membership = await verifyWorkspaceMembershipType({
    supabase: context.supabase,
    userId: context.user.id,
    wsId: resolvedWsId,
  });

  if (membership.error === 'membership_lookup_failed') {
    return NextResponse.json(
      { message: 'Could not verify workspace membership' },
      { status: 500 }
    );
  }

  if (!membership.ok) {
    return NextResponse.json(
      { message: "You don't have access to this workspace" },
      { status: 403 }
    );
  }

  return null;
}

function pickFallbackScenario(seed: string | undefined) {
  const source = seed || `${Date.now()}`;
  const index =
    [...source].reduce(
      (total, character) => total + character.charCodeAt(0),
      0
    ) % FALLBACK_SCENARIOS.length;
  return FALLBACK_SCENARIOS[index] ?? FALLBACK_SCENARIOS[0];
}

export const POST = withSessionAuth<Params>(
  async (request, context, { wsId }) => {
    const accessError = await verifyAccess(context, wsId);
    if (accessError) return accessError;

    const rawBody = (await request.json().catch(() => ({}))) as unknown;
    const parsed = ScenarioRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid scenario request' },
        { status: 400 }
      );
    }

    const fallback = pickFallbackScenario(parsed.data.seed);

    try {
      const { object } = await generateObject({
        model: google('gemini-2.0-flash'),
        schema: ScenarioSchema,
        system:
          'You are Mira, Tuturuuu’s internal education assistant. Create realistic, demo-ready classroom voice scenarios for a Valsea edtech hackathon. Keep them useful for teachers in Southeast Asia.',
        prompt: `Create one vivid classroom scenario for Valsea Classroom Studio.

Mode: ${parsed.data.mode ?? 'surprise me'}
Seed: ${parsed.data.seed ?? 'random'}

The result must include:
- a learner voice phrase that can be pasted as a reference transcript,
- tags for the UI,
- likely pronunciation or comprehension confusions,
- a teacher goal,
- a grading rubric,
- a source language and target language supported by the page,
- one output type supported by the Valsea formatting API.

Avoid generic language. Make it feel like a real classroom moment.`,
      });

      return NextResponse.json(object);
    } catch (error) {
      serverLogger.warn('Falling back to local Valsea scenario seed', error);
      return NextResponse.json(fallback);
    }
  },
  {
    rateLimit: { maxRequests: 12, windowMs: 60_000 },
  }
);
