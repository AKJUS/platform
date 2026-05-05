import type { Tables } from '@tuturuuu/types/supabase';

import { getAdmin } from './db';
import { firstOf } from './helpers';
import type { Db } from './types';

type ModuleIdOnly = Pick<Tables<'workspace_course_modules'>, 'id'>;

interface CourseSummary {
  id: string;
  name: string;
  description: string | null;
  completedModules: number;
  totalModules: number;
  progress: number;
}

interface CourseModuleSummary {
  id: string;
  name: string;
  sort_key: number | null;
  is_published: boolean;
  completed: boolean;
  locked: boolean;
  counts: {
    flashcards: number;
    quizzes: number;
    quizSets: number;
  };
}

interface CourseDetail extends CourseSummary {
  modules: CourseModuleSummary[];
}

type FlashcardJoinRow = {
  workspace_flashcards:
    | Pick<Tables<'workspace_flashcards'>, 'id' | 'front' | 'back'>
    | Pick<Tables<'workspace_flashcards'>, 'id' | 'front' | 'back'>[]
    | null;
};

type QuizJoinRow = {
  workspace_quizzes:
    | Pick<Tables<'workspace_quizzes'>, 'id' | 'question' | 'score'>
    | Pick<Tables<'workspace_quizzes'>, 'id' | 'question' | 'score'>[]
    | null;
};

type QuizSetJoinRow = {
  workspace_quiz_sets:
    | Pick<Tables<'workspace_quiz_sets'>, 'id' | 'name'>
    | Pick<Tables<'workspace_quiz_sets'>, 'id' | 'name'>[]
    | null;
};

export async function getAssignedCourseIds({
  db,
  studentWorkspaceUserId,
  wsId,
}: {
  db?: Db;
  studentWorkspaceUserId: string;
  wsId: string;
}) {
  const admin = await getAdmin(db);
  const { data, error } = await admin
    .from('workspace_user_groups_users')
    .select(
      'group_id, workspace_user_groups!inner(id, ws_id, archived, is_guest)'
    )
    .eq('user_id', studentWorkspaceUserId)
    .eq('workspace_user_groups.ws_id', wsId)
    .eq('workspace_user_groups.archived', false)
    .eq('workspace_user_groups.is_guest', false);

  if (error) throw error;
  return (data ?? []).map((row) => row.group_id);
}

export async function getLearnerCourseSummaries({
  db,
  studentPlatformUserId,
  studentWorkspaceUserId,
  wsId,
}: {
  db?: Db;
  studentPlatformUserId: string;
  studentWorkspaceUserId: string;
  wsId: string;
}): Promise<CourseSummary[]> {
  const admin = await getAdmin(db);
  const courseIds = await getAssignedCourseIds({
    db: admin,
    studentWorkspaceUserId,
    wsId,
  });

  if (!courseIds.length) return [];

  const [coursesResult, modulesResult, completionsResult] = await Promise.all([
    admin
      .from('workspace_user_groups')
      .select('id, name, description')
      .eq('ws_id', wsId)
      .in('id', courseIds)
      .order('name', { ascending: true }),
    admin
      .from('workspace_course_modules')
      .select('id, group_id')
      .in('group_id', courseIds)
      .eq('is_published', true),
    admin
      .from('course_module_completion_status')
      .select('module_id')
      .eq('user_id', studentPlatformUserId)
      .eq('completion_status', true),
  ]);

  if (coursesResult.error) throw coursesResult.error;
  if (modulesResult.error) throw modulesResult.error;
  if (completionsResult.error) throw completionsResult.error;

  const completedModuleIds = new Set(
    (completionsResult.data ?? []).map((row) => row.module_id)
  );
  const modulesByCourse = new Map<string, string[]>();
  for (const module of modulesResult.data ?? []) {
    const modules = modulesByCourse.get(module.group_id) ?? [];
    modules.push(module.id);
    modulesByCourse.set(module.group_id, modules);
  }

  return (coursesResult.data ?? []).map((course) => {
    const moduleIds = modulesByCourse.get(course.id) ?? [];
    const completedModules = moduleIds.filter((moduleId) =>
      completedModuleIds.has(moduleId)
    ).length;

    return {
      id: course.id,
      name: course.name,
      description: course.description ?? null,
      completedModules,
      totalModules: moduleIds.length,
      progress: moduleIds.length
        ? Math.round((completedModules / moduleIds.length) * 100)
        : 0,
    };
  });
}

function countByModule(rows: ModuleIdOnly[], moduleIds: Set<string>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!moduleIds.has(row.id)) continue;
    map.set(row.id, (map.get(row.id) ?? 0) + 1);
  }
  return map;
}

export async function getLearnerCourseDetail({
  courseId,
  db,
  studentPlatformUserId,
  studentWorkspaceUserId,
  wsId,
}: {
  courseId: string;
  db?: Db;
  studentPlatformUserId: string;
  studentWorkspaceUserId: string;
  wsId: string;
}): Promise<CourseDetail | null> {
  const admin = await getAdmin(db);
  const courseIds = await getAssignedCourseIds({
    db: admin,
    studentWorkspaceUserId,
    wsId,
  });
  if (!courseIds.includes(courseId)) return null;

  const [
    courseResult,
    modulesResult,
    completionsResult,
    flashcards,
    quizzes,
    quizSets,
  ] = await Promise.all([
    admin
      .from('workspace_user_groups')
      .select('id, name, description')
      .eq('ws_id', wsId)
      .eq('id', courseId)
      .maybeSingle(),
    admin
      .from('workspace_course_modules')
      .select('id, name, sort_key, is_published')
      .eq('group_id', courseId)
      .order('sort_key', { ascending: true }),
    admin
      .from('course_module_completion_status')
      .select('module_id')
      .eq('user_id', studentPlatformUserId)
      .eq('completion_status', true),
    admin.from('course_module_flashcards').select('module_id'),
    admin.from('course_module_quizzes').select('module_id'),
    admin.from('course_module_quiz_sets').select('module_id'),
  ]);

  if (courseResult.error) throw courseResult.error;
  if (modulesResult.error) throw modulesResult.error;
  if (completionsResult.error) throw completionsResult.error;
  if (flashcards.error) throw flashcards.error;
  if (quizzes.error) throw quizzes.error;
  if (quizSets.error) throw quizSets.error;
  if (!courseResult.data) return null;

  const moduleIds = new Set(
    (modulesResult.data ?? []).map((module) => module.id)
  );
  const completedModuleIds = new Set(
    (completionsResult.data ?? []).map((row) => row.module_id)
  );

  const flashcardCounts = countByModule(
    ((flashcards.data ?? []) as { module_id: string | null }[])
      .filter((row): row is { module_id: string } => Boolean(row.module_id))
      .map((row) => ({ id: row.module_id })),
    moduleIds
  );
  const quizCounts = countByModule(
    ((quizzes.data ?? []) as { module_id: string | null }[])
      .filter((row): row is { module_id: string } => Boolean(row.module_id))
      .map((row) => ({ id: row.module_id })),
    moduleIds
  );
  const quizSetCounts = countByModule(
    ((quizSets.data ?? []) as { module_id: string | null }[])
      .filter((row): row is { module_id: string } => Boolean(row.module_id))
      .map((row) => ({ id: row.module_id })),
    moduleIds
  );

  let priorIncomplete = false;
  const modules: CourseModuleSummary[] = (modulesResult.data ?? []).map(
    (module) => {
      const completed = completedModuleIds.has(module.id);
      const locked = !module.is_published || priorIncomplete;
      if (!completed && module.is_published) priorIncomplete = true;

      return {
        id: module.id,
        name: module.name,
        sort_key: module.sort_key,
        is_published: module.is_published,
        completed,
        locked,
        counts: {
          flashcards: flashcardCounts.get(module.id) ?? 0,
          quizzes: quizCounts.get(module.id) ?? 0,
          quizSets: quizSetCounts.get(module.id) ?? 0,
        },
      };
    }
  );

  const completedModules = modules.filter((module) => module.completed).length;
  return {
    id: courseResult.data.id,
    name: courseResult.data.name,
    description: courseResult.data.description ?? null,
    completedModules,
    totalModules: modules.length,
    progress: modules.length
      ? Math.round((completedModules / modules.length) * 100)
      : 0,
    modules,
  };
}

export async function getLearnerModuleDetail({
  courseId,
  db,
  moduleId,
  studentPlatformUserId,
  studentWorkspaceUserId,
  wsId,
}: {
  courseId: string;
  db?: Db;
  moduleId: string;
  studentPlatformUserId: string;
  studentWorkspaceUserId: string;
  wsId: string;
}) {
  const course = await getLearnerCourseDetail({
    courseId,
    db,
    studentPlatformUserId,
    studentWorkspaceUserId,
    wsId,
  });
  if (!course) return null;

  const summary = course.modules.find((module) => module.id === moduleId);
  if (!summary) return null;

  const admin = await getAdmin(db);
  const [moduleResult, flashcardsResult, quizzesResult, quizSetsResult] =
    await Promise.all([
      admin
        .from('workspace_course_modules')
        .select('content, extra_content, youtube_links')
        .eq('id', moduleId)
        .eq('group_id', courseId)
        .maybeSingle(),
      admin
        .from('course_module_flashcards')
        .select('workspace_flashcards(id, front, back)')
        .eq('module_id', moduleId),
      admin
        .from('course_module_quizzes')
        .select('workspace_quizzes(id, question, score)')
        .eq('module_id', moduleId),
      admin
        .from('course_module_quiz_sets')
        .select('workspace_quiz_sets(id, name)')
        .eq('module_id', moduleId),
    ]);

  if (moduleResult.error) throw moduleResult.error;
  if (flashcardsResult.error) throw flashcardsResult.error;
  if (quizzesResult.error) throw quizzesResult.error;
  if (quizSetsResult.error) throw quizSetsResult.error;
  if (!moduleResult.data) return null;

  const flashcardRows = (flashcardsResult.data ?? []) as FlashcardJoinRow[];
  const quizRows = (quizzesResult.data ?? []) as QuizJoinRow[];
  const quizSetRows = (quizSetsResult.data ?? []) as QuizSetJoinRow[];

  return {
    ...summary,
    content: moduleResult.data.content,
    extra_content: moduleResult.data.extra_content,
    youtube_links: moduleResult.data.youtube_links,
    flashcards: flashcardRows
      .map((row) => firstOf(row.workspace_flashcards))
      .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    quizzes: quizRows
      .map((row) => firstOf(row.workspace_quizzes))
      .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    quizSets: quizSetRows
      .map((row) => firstOf(row.workspace_quiz_sets))
      .filter((value): value is NonNullable<typeof value> => Boolean(value)),
  };
}

export async function getRecommendedPracticeItem({
  db,
  studentPlatformUserId,
  studentWorkspaceUserId,
  wsId,
}: {
  db?: Db;
  studentPlatformUserId: string;
  studentWorkspaceUserId: string;
  wsId: string;
}) {
  const courses = await getLearnerCourseSummaries({
    db,
    studentPlatformUserId,
    studentWorkspaceUserId,
    wsId,
  });
  const firstCourse = courses[0];
  if (!firstCourse) return null;

  const detail = await getLearnerCourseDetail({
    courseId: firstCourse.id,
    db,
    studentPlatformUserId,
    studentWorkspaceUserId,
    wsId,
  });
  const module =
    detail?.modules.find(
      (candidate) => !candidate.completed && !candidate.locked
    ) ?? detail?.modules.find((candidate) => !candidate.locked);
  if (!detail || !module) return null;

  return {
    type: 'module' as const,
    id: module.id,
    title: module.name,
    courseId: detail.id,
    courseName: detail.name,
    prompt: detail.description,
  };
}
