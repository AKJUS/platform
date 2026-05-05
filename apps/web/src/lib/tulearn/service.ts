import 'server-only';

import { createAdminClient } from '@tuturuuu/supabase/next/server';
import type { SupabaseUser } from '@tuturuuu/supabase/next/user';
import type { TypedSupabaseClient } from '@tuturuuu/supabase/types';
import type { TablesInsert } from '@tuturuuu/types/supabase';
import { normalizeWorkspaceId } from '@tuturuuu/utils/workspace-helper';

const ENABLE_EDUCATION_SECRET = 'ENABLE_EDUCATION';
const DEFAULT_HEARTS = 5;
const HEART_REFILL_MS = 4 * 60 * 60 * 1000;

export type TulearnRole = 'student' | 'parent';

export interface TulearnWorkspaceSummary {
  id: string;
  name: string;
  avatar_url: string | null;
  logo_url: string | null;
  roles: TulearnRole[];
}

export interface TulearnStudentSummary {
  id: string;
  platform_user_id: string;
  workspace_user_id: string;
  workspace_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
}

export interface TulearnSubject {
  role: TulearnRole;
  readOnly: boolean;
  wsId: string;
  studentPlatformUserId: string;
  studentWorkspaceUserId: string;
  studentName: string;
}

export interface TulearnState {
  hearts: number;
  max_hearts: number;
  xp_total: number;
  current_streak: number;
  longest_streak: number;
  streak_freezes: number;
  last_activity_date: string | null;
}

type Db = TypedSupabaseClient;

function truthy(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  );
}

function toDisplayName(user: {
  display_name?: string | null;
  email?: string | null;
  full_name?: string | null;
}) {
  return user.display_name || user.full_name || user.email || 'Learner';
}

function toDateKey(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function getYesterdayKey() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return toDateKey(date);
}

async function getAdmin(db?: Db) {
  return db ?? ((await createAdminClient()) as Db);
}

export async function hasEducationEnabled(wsId: string, db?: Db) {
  const admin = await getAdmin(db);
  const { data, error } = await admin
    .from('workspace_secrets')
    .select('value')
    .eq('ws_id', wsId)
    .eq('name', ENABLE_EDUCATION_SECRET)
    .maybeSingle();

  if (error) throw error;
  return truthy(data?.value);
}

export async function resolveStudentForPlatformUser({
  db,
  platformUserId,
  wsId,
}: {
  db?: Db;
  platformUserId: string;
  wsId: string;
}) {
  const admin = await getAdmin(db);
  const { data, error } = await admin
    .from('workspace_user_linked_users')
    .select(
      'virtual_user_id, workspace_users!inner(id, full_name, display_name, email, avatar_url, ws_id)'
    )
    .eq('platform_user_id', platformUserId)
    .eq('ws_id', wsId)
    .maybeSingle();

  if (error) throw error;
  const workspaceUser = Array.isArray(data?.workspace_users)
    ? data?.workspace_users[0]
    : data?.workspace_users;

  if (!data?.virtual_user_id || !workspaceUser) return null;

  return {
    id: data.virtual_user_id,
    platform_user_id: platformUserId,
    workspace_user_id: data.virtual_user_id,
    workspace_id: wsId,
    name: toDisplayName(workspaceUser),
    email: workspaceUser.email ?? null,
    avatar_url: workspaceUser.avatar_url ?? null,
  } satisfies TulearnStudentSummary;
}

export async function resolveTulearnSubject({
  requestSupabase,
  studentId,
  user,
  wsId,
}: {
  requestSupabase: Db;
  studentId?: string | null;
  user: SupabaseUser;
  wsId: string;
}): Promise<TulearnSubject | Response> {
  const normalizedWsId = await normalizeWorkspaceId(wsId, requestSupabase);
  const admin = await getAdmin();

  if (!(await hasEducationEnabled(normalizedWsId, admin))) {
    return Response.json(
      { message: 'Tulearn is not enabled for this workspace' },
      { status: 404 }
    );
  }

  const selfStudent = await resolveStudentForPlatformUser({
    db: admin,
    platformUserId: user.id,
    wsId: normalizedWsId,
  });

  if (!studentId && selfStudent) {
    return {
      role: 'student',
      readOnly: false,
      wsId: normalizedWsId,
      studentPlatformUserId: user.id,
      studentWorkspaceUserId: selfStudent.workspace_user_id,
      studentName: selfStudent.name,
    };
  }

  let parentLinkQuery = admin
    .from('tulearn_parent_student_links')
    .select('student_platform_user_id, student_workspace_user_id')
    .eq('ws_id', normalizedWsId)
    .eq('parent_user_id', user.id)
    .eq('status', 'active');

  if (studentId) {
    parentLinkQuery = parentLinkQuery.eq(
      'student_workspace_user_id',
      studentId
    );
  }

  const { data: link, error } = await parentLinkQuery
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!link) {
    return Response.json(
      { message: "You don't have access to this learner" },
      { status: 403 }
    );
  }

  const { data: workspaceUser, error: workspaceUserError } = await admin
    .from('workspace_users')
    .select('id, full_name, display_name, email, avatar_url')
    .eq('id', link.student_workspace_user_id)
    .eq('ws_id', normalizedWsId)
    .maybeSingle();

  if (workspaceUserError) throw workspaceUserError;

  return {
    role: 'parent',
    readOnly: true,
    wsId: normalizedWsId,
    studentPlatformUserId: link.student_platform_user_id,
    studentWorkspaceUserId: link.student_workspace_user_id,
    studentName: workspaceUser ? toDisplayName(workspaceUser) : 'Learner',
  };
}

export async function getTulearnBootstrap({
  requestSupabase,
  user,
}: {
  requestSupabase: Db;
  user: SupabaseUser;
}) {
  const admin = await getAdmin();
  const [
    membershipWorkspacesResult,
    parentLinksResult,
    profileResult,
    privateDetailsResult,
  ] = await Promise.all([
    admin
      .from('workspaces')
      .select(
        'id, name, avatar_url, logo_url, workspace_members!inner(user_id), workspace_secrets!inner(name, value)'
      )
      .eq('workspace_members.user_id', user.id)
      .eq('workspace_secrets.name', ENABLE_EDUCATION_SECRET)
      .eq('workspace_secrets.value', 'true'),
    admin
      .from('tulearn_parent_student_links')
      .select('ws_id, student_platform_user_id, student_workspace_user_id')
      .eq('parent_user_id', user.id)
      .eq('status', 'active'),
    requestSupabase
      .from('users')
      .select('id, display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle(),
    requestSupabase
      .from('user_private_details')
      .select('email, full_name')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (membershipWorkspacesResult.error) throw membershipWorkspacesResult.error;
  if (parentLinksResult.error) throw parentLinksResult.error;

  const workspaceMap = new Map<string, TulearnWorkspaceSummary>();
  for (const workspace of membershipWorkspacesResult.data ?? []) {
    workspaceMap.set(workspace.id, {
      id: workspace.id,
      name: workspace.name ?? 'Education workspace',
      avatar_url: workspace.avatar_url ?? null,
      logo_url: workspace.logo_url ?? null,
      roles: ['student'],
    });
  }

  const parentLinks = parentLinksResult.data ?? [];
  const parentWorkspaceIds = [
    ...new Set(parentLinks.map((link) => link.ws_id)),
  ];
  const [parentWorkspacesResult, parentStudentsResult] = await Promise.all([
    parentWorkspaceIds.length
      ? admin
          .from('workspaces')
          .select(
            'id, name, avatar_url, logo_url, workspace_secrets!inner(name, value)'
          )
          .in('id', parentWorkspaceIds)
          .eq('workspace_secrets.name', ENABLE_EDUCATION_SECRET)
          .eq('workspace_secrets.value', 'true')
      : Promise.resolve({ data: [], error: null }),
    parentLinks.length
      ? admin
          .from('workspace_users')
          .select('id, ws_id, full_name, display_name, email, avatar_url')
          .in(
            'id',
            parentLinks.map((link) => link.student_workspace_user_id)
          )
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (parentWorkspacesResult.error) throw parentWorkspacesResult.error;
  if (parentStudentsResult.error) throw parentStudentsResult.error;

  for (const workspace of parentWorkspacesResult.data ?? []) {
    const existing = workspaceMap.get(workspace.id);
    if (existing) {
      if (!existing.roles.includes('parent')) existing.roles.push('parent');
      continue;
    }
    workspaceMap.set(workspace.id, {
      id: workspace.id,
      name: workspace.name ?? 'Education workspace',
      avatar_url: workspace.avatar_url ?? null,
      logo_url: workspace.logo_url ?? null,
      roles: ['parent'],
    });
  }

  const studentsByWorkspaceUserId = new Map(
    (parentStudentsResult.data ?? []).map((student) => [student.id, student])
  );

  return {
    profile: {
      id: user.id,
      email: privateDetailsResult.data?.email ?? user.email ?? null,
      display_name:
        profileResult.data?.display_name ??
        privateDetailsResult.data?.full_name ??
        user.email ??
        null,
      avatar_url: profileResult.data?.avatar_url ?? null,
    },
    workspaces: Array.from(workspaceMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    linkedStudents: parentLinks
      .map((link) => {
        const student = studentsByWorkspaceUserId.get(
          link.student_workspace_user_id
        );
        if (!student || !workspaceMap.has(link.ws_id)) return null;
        return {
          id: link.student_workspace_user_id,
          platform_user_id: link.student_platform_user_id,
          workspace_user_id: link.student_workspace_user_id,
          workspace_id: link.ws_id,
          name: toDisplayName(student),
          email: student.email ?? null,
          avatar_url: student.avatar_url ?? null,
        } satisfies TulearnStudentSummary;
      })
      .filter((student): student is TulearnStudentSummary => Boolean(student)),
  };
}

export async function getLearnerState({
  db,
  userId,
  wsId,
}: {
  db?: Db;
  userId: string;
  wsId: string;
}): Promise<TulearnState> {
  const admin = await getAdmin(db);
  const { data, error } = await admin
    .from('tulearn_learner_state')
    .select(
      'hearts, max_hearts, xp_total, current_streak, longest_streak, streak_freezes, last_activity_date, last_heart_refill_at'
    )
    .eq('ws_id', wsId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const initial = {
      ws_id: wsId,
      user_id: userId,
      hearts: DEFAULT_HEARTS,
      max_hearts: DEFAULT_HEARTS,
    };
    const { data: created, error: createError } = await admin
      .from('tulearn_learner_state')
      .insert(initial)
      .select(
        'hearts, max_hearts, xp_total, current_streak, longest_streak, streak_freezes, last_activity_date'
      )
      .single();
    if (createError) throw createError;
    return created;
  }

  const lastRefill = new Date(data.last_heart_refill_at).getTime();
  if (
    data.hearts < data.max_hearts &&
    Number.isFinite(lastRefill) &&
    Date.now() - lastRefill >= HEART_REFILL_MS
  ) {
    const { data: refilled, error: refillError } = await admin
      .from('tulearn_learner_state')
      .update({
        hearts: data.max_hearts,
        last_heart_refill_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('ws_id', wsId)
      .eq('user_id', userId)
      .select(
        'hearts, max_hearts, xp_total, current_streak, longest_streak, streak_freezes, last_activity_date'
      )
      .single();
    if (refillError) throw refillError;
    return refilled;
  }

  return data;
}

export async function awardTulearnXp({
  db,
  idempotencyKey,
  metadata = {},
  sourceId,
  sourceType,
  userId,
  wsId,
  xp,
}: {
  db?: Db;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  sourceId?: string | null;
  sourceType:
    | 'assignment'
    | 'daily_goal'
    | 'flashcard'
    | 'manual'
    | 'module'
    | 'quiz'
    | 'quiz_set';
  userId: string;
  wsId: string;
  xp: number;
}) {
  const admin = await getAdmin(db);
  const eventPayload: TablesInsert<'tulearn_gamification_events'> = {
    ws_id: wsId,
    user_id: userId,
    source_type: sourceType,
    source_id: sourceId ?? null,
    xp,
    idempotency_key: idempotencyKey,
    metadata:
      metadata as TablesInsert<'tulearn_gamification_events'>['metadata'],
  };
  const { error } = await admin
    .from('tulearn_gamification_events')
    .insert(eventPayload);

  if (error) {
    if (error.code === '23505') {
      return { awarded: false, xp: 0 };
    }
    throw error;
  }

  const currentState = await getLearnerState({ db: admin, userId, wsId });
  const today = toDateKey();
  const yesterday = getYesterdayKey();
  const nextStreak =
    currentState.last_activity_date === today
      ? currentState.current_streak
      : currentState.last_activity_date === yesterday
        ? currentState.current_streak + 1
        : 1;

  const { error: updateError } = await admin
    .from('tulearn_learner_state')
    .update({
      xp_total: currentState.xp_total + xp,
      current_streak: nextStreak,
      longest_streak: Math.max(currentState.longest_streak, nextStreak),
      last_activity_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('ws_id', wsId)
    .eq('user_id', userId);

  if (updateError) throw updateError;
  return { awarded: true, xp };
}

export async function loseHeart({
  db,
  userId,
  wsId,
}: {
  db?: Db;
  userId: string;
  wsId: string;
}) {
  const admin = await getAdmin(db);
  const state = await getLearnerState({ db: admin, userId, wsId });
  const nextHearts = Math.max(0, state.hearts - 1);
  const { error } = await admin
    .from('tulearn_learner_state')
    .update({
      hearts: nextHearts,
      updated_at: new Date().toISOString(),
    })
    .eq('ws_id', wsId)
    .eq('user_id', userId);

  if (error) throw error;
  return nextHearts;
}

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
}) {
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
}) {
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
    admin.from('course_module_flashcards').select('module_id').returns<any[]>(),
    admin.from('course_module_quizzes').select('module_id').returns<any[]>(),
    admin.from('course_module_quiz_sets').select('module_id').returns<any[]>(),
  ]);

  if (courseResult.error) throw courseResult.error;
  if (modulesResult.error) throw modulesResult.error;
  if (completionsResult.error) throw completionsResult.error;
  if (flashcards.error) throw flashcards.error;
  if (quizzes.error) throw quizzes.error;
  if (quizSets.error) throw quizSets.error;
  if (!courseResult.data) return null;

  const moduleIds = (modulesResult.data ?? []).map((module) => module.id);
  const completedModuleIds = new Set(
    (completionsResult.data ?? []).map((row) => row.module_id)
  );
  const countByModule = (rows: any[]) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (!moduleIds.includes(row.module_id)) continue;
      map.set(row.module_id, (map.get(row.module_id) ?? 0) + 1);
    }
    return map;
  };

  const flashcardCounts = countByModule(flashcards.data ?? []);
  const quizCounts = countByModule(quizzes.data ?? []);
  const quizSetCounts = countByModule(quizSets.data ?? []);
  let priorIncomplete = false;
  const modules = (modulesResult.data ?? []).map((module) => {
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
  });

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
        .eq('module_id', moduleId)
        .returns<any[]>(),
      admin
        .from('course_module_quizzes')
        .select('workspace_quizzes(id, question, score)')
        .eq('module_id', moduleId)
        .returns<any[]>(),
      admin
        .from('course_module_quiz_sets')
        .select('workspace_quiz_sets(id, name)')
        .eq('module_id', moduleId)
        .returns<any[]>(),
    ]);

  if (moduleResult.error) throw moduleResult.error;
  if (flashcardsResult.error) throw flashcardsResult.error;
  if (quizzesResult.error) throw quizzesResult.error;
  if (quizSetsResult.error) throw quizSetsResult.error;
  if (!moduleResult.data) return null;

  const flatten = <T>(value: T | T[] | null | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return {
    ...summary,
    content: moduleResult.data.content,
    extra_content: moduleResult.data.extra_content,
    youtube_links: moduleResult.data.youtube_links,
    flashcards: (flashcardsResult.data ?? [])
      .map((row) => flatten(row.workspace_flashcards))
      .filter(Boolean),
    quizzes: (quizzesResult.data ?? [])
      .map((row) => flatten(row.workspace_quizzes))
      .filter(Boolean),
    quizSets: (quizSetsResult.data ?? [])
      .map((row) => flatten(row.workspace_quiz_sets))
      .filter(Boolean),
  };
}

export async function getLearnerAssignments({
  db,
  studentWorkspaceUserId,
  wsId,
}: {
  db?: Db;
  studentWorkspaceUserId: string;
  wsId: string;
}) {
  const admin = await getAdmin(db);
  const courseIds = await getAssignedCourseIds({
    db: admin,
    studentWorkspaceUserId,
    wsId,
  });
  if (!courseIds.length) return [];

  const [postsResult, checksResult] = await Promise.all([
    admin
      .from('user_group_posts')
      .select(
        'id, title, content, created_at, group_id, workspace_user_groups!inner(id, name, ws_id)'
      )
      .in('group_id', courseIds)
      .eq('workspace_user_groups.ws_id', wsId)
      .order('created_at', { ascending: false })
      .limit(12)
      .returns<any[]>(),
    admin
      .from('user_group_post_checks')
      .select('post_id, is_completed, approval_status')
      .eq('user_id', studentWorkspaceUserId),
  ]);

  if (postsResult.error) throw postsResult.error;
  if (checksResult.error) throw checksResult.error;

  const checksByPost = new Map(
    (checksResult.data ?? []).map((check) => [check.post_id, check])
  );

  return (postsResult.data ?? []).map((post) => {
    const course = Array.isArray(post.workspace_user_groups)
      ? post.workspace_user_groups[0]
      : post.workspace_user_groups;
    const check = checksByPost.get(post.id);
    return {
      id: post.id,
      title: post.title ?? 'Untitled assignment',
      content: post.content ?? null,
      created_at: post.created_at,
      course: {
        id: post.group_id,
        name: course?.name ?? 'Course',
      },
      is_completed: Boolean(check?.is_completed),
      approval_status: check?.approval_status ?? null,
    };
  });
}

export async function getLearnerReports({
  db,
  studentWorkspaceUserId,
  wsId,
}: {
  db?: Db;
  studentWorkspaceUserId: string;
  wsId: string;
}) {
  const admin = await getAdmin(db);
  const courseIds = await getAssignedCourseIds({
    db: admin,
    studentWorkspaceUserId,
    wsId,
  });
  if (!courseIds.length) return [];

  const { data, error } = await admin
    .from('external_user_monthly_reports')
    .select(
      'id, title, content, feedback, score, created_at, group_id, workspace_user_groups!inner(id, name, ws_id)'
    )
    .eq('user_id', studentWorkspaceUserId)
    .in('group_id', courseIds)
    .eq('workspace_user_groups.ws_id', wsId)
    .order('created_at', { ascending: false })
    .limit(12)
    .returns<any[]>();

  if (error) throw error;

  return (data ?? []).map((report) => {
    const course = Array.isArray(report.workspace_user_groups)
      ? report.workspace_user_groups[0]
      : report.workspace_user_groups;
    return {
      id: report.id,
      title: report.title,
      content: report.content,
      feedback: report.feedback ?? null,
      score: report.score ?? null,
      created_at: report.created_at,
      course: course
        ? {
            id: course.id,
            name: course.name,
          }
        : null,
    };
  });
}

export async function getLearnerMarks({
  db,
  studentWorkspaceUserId,
  wsId,
}: {
  db?: Db;
  studentWorkspaceUserId: string;
  wsId: string;
}) {
  const admin = await getAdmin(db);
  const courseIds = await getAssignedCourseIds({
    db: admin,
    studentWorkspaceUserId,
    wsId,
  });
  if (!courseIds.length) return [];

  const { data, error } = await admin
    .from('user_indicators')
    .select(
      'indicator_id, value, created_at, user_group_metrics!inner(id, name, unit, group_id, ws_id, workspace_user_groups(id, name))'
    )
    .eq('user_id', studentWorkspaceUserId)
    .eq('user_group_metrics.ws_id', wsId)
    .in('user_group_metrics.group_id', courseIds)
    .order('created_at', { ascending: false })
    .limit(24)
    .returns<any[]>();

  if (error) throw error;

  return (data ?? []).map((mark) => {
    const metric = Array.isArray(mark.user_group_metrics)
      ? mark.user_group_metrics[0]
      : mark.user_group_metrics;
    const course = Array.isArray(metric?.workspace_user_groups)
      ? metric.workspace_user_groups[0]
      : metric?.workspace_user_groups;
    return {
      id: `${mark.indicator_id}:${studentWorkspaceUserId}`,
      value: mark.value ?? null,
      created_at: mark.created_at ?? null,
      metric: {
        id: metric?.id ?? mark.indicator_id,
        name: metric?.name ?? 'Mark',
        unit: metric?.unit ?? null,
      },
      course: course
        ? {
            id: course.id,
            name: course.name,
          }
        : null,
    };
  });
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
