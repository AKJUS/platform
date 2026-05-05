import { normalizeWorkspaceId } from '@tuturuuu/utils/workspace-helper';

import { ENABLE_EDUCATION_SECRET } from './constants';
import { getAdmin } from './db';
import { toDisplayName, truthy } from './helpers';
import type {
  Db,
  ResolveTulearnSubjectInput,
  TulearnBootstrapInput,
  TulearnStudentSummary,
  TulearnSubject,
  TulearnWorkspaceSummary,
} from './types';

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
}: ResolveTulearnSubjectInput): Promise<TulearnSubject | Response> {
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
}: TulearnBootstrapInput) {
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
