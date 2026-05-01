import { google } from '@ai-sdk/google';
import { executeConvertFileToMarkdown } from '@tuturuuu/ai/tools/executors/markitdown';
import {
  createAdminClient,
  createClient,
} from '@tuturuuu/supabase/next/server';
import type { TablesInsert } from '@tuturuuu/types';
import { sanitizePath } from '@tuturuuu/utils/storage-path';
import {
  getPermissions,
  normalizeWorkspaceId,
} from '@tuturuuu/utils/workspace-helper';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ModuleGenerationSchema = z.object({
  modules: z
    .array(
      z.object({
        name: z
          .string()
          .describe('The main title of the module derived from the document.'),
        content: z
          .string()
          .describe(
            'The detailed learning content or lesson formatted in markdown.'
          ),
        extra_content: z
          .string()
          .describe('Key takeaways, glossary, or supplementary information.')
          .optional(),
        quiz_questions: z
          .array(
            z.object({
              question: z.string(),
              options: z.array(z.string()),
              correct_answer: z.string(),
            })
          )
          .describe('Suggested quiz questions based on the document.')
          .optional(),
      })
    )
    .min(1)
    .describe(
      'A list of course modules extracted from the document. Large documents should be broken down into multiple modules.'
    ),
});

const GenerateCourseRequestSchema = z.object({
  fileName: z.string().max(255).optional(),
  groupId: z.string().uuid(),
  maxCharacters: z.number().int().positive().max(1_000_000).optional(),
  storagePath: z.string().min(1).max(1024),
  wsId: z.string().min(1),
});

function isGroupStoragePath(
  storagePath: string,
  normalizedWsId: string,
  groupId: string
) {
  return (
    storagePath.startsWith(`${normalizedWsId}/user-groups/${groupId}/`) ||
    storagePath.startsWith(`user-groups/${groupId}/`)
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient(request);

    // 1. Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request payload
    const parsedBody = GenerateCourseRequestSchema.safeParse(
      await request.json()
    );

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsedBody.error.issues },
        { status: 400 }
      );
    }

    const { fileName, groupId, maxCharacters, storagePath, wsId } =
      parsedBody.data;
    const normalizedWsId = await normalizeWorkspaceId(wsId, supabase);
    const sanitizedStoragePath = sanitizePath(storagePath);

    if (
      sanitizedStoragePath === null ||
      !isGroupStoragePath(sanitizedStoragePath, normalizedWsId, groupId)
    ) {
      return NextResponse.json(
        { error: 'Storage path is not authorized for this group' },
        { status: 403 }
      );
    }

    const permissions = await getPermissions({ wsId: normalizedWsId, request });
    if (
      !permissions?.containsPermission('view_user_groups') ||
      !permissions.containsPermission('update_user_groups')
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sbAdmin = await createAdminClient();
    const { data: group, error: groupError } = await sbAdmin
      .from('workspace_user_groups')
      .select('id')
      .eq('ws_id', normalizedWsId)
      .eq('id', groupId)
      .maybeSingle();

    if (groupError) {
      return NextResponse.json(
        { error: 'Failed to verify user group', message: groupError.message },
        { status: 500 }
      );
    }

    if (!group) {
      return NextResponse.json(
        { error: 'User group not found' },
        { status: 404 }
      );
    }

    // 3. Extract text from PDF using MarkItDown tool
    const markitdownResult = await executeConvertFileToMarkdown(
      {
        storagePath: sanitizedStoragePath,
        fileName,
        maxCharacters: maxCharacters || 120_000,
      },
      {
        wsId: normalizedWsId,
        userId: user.id,
        supabase,
      }
    );

    if (!markitdownResult.ok) {
      return NextResponse.json(
        {
          error: markitdownResult.error,
          details: 'Failed to extract text from document.',
        },
        { status: 500 }
      );
    }

    const markdownText = markitdownResult.markdown;

    const { object } = await generateObject({
      model: google('gemini-2.0-flash'),
      schema: ModuleGenerationSchema,
      system:
        'You are an expert educator. Your task is to analyze documents and extract structured, engaging learning modules from them.',
      prompt: `Please create structured course modules based on the following document text. Extract the main lessons, key takeaways, and suggest a few quiz questions to test the learner's knowledge. Break down large documents into multiple logical modules.\n\nDocument Content:\n${markdownText}`,
    });

    const { data: existingModuleGroup, error: moduleGroupError } = await sbAdmin
      .from('workspace_course_module_groups')
      .select('id')
      .eq('group_id', groupId)
      .order('sort_key', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (moduleGroupError) {
      return NextResponse.json(
        {
          error: 'Failed to find a target module group.',
          message: moduleGroupError.message,
        },
        { status: 500 }
      );
    }

    let moduleGroupId = existingModuleGroup?.id;
    if (!moduleGroupId) {
      const moduleGroupPayload: TablesInsert<'workspace_course_module_groups'> =
        {
          group_id: groupId,
          sort_key: 0,
          title: 'Generated modules',
        };

      const { data: createdModuleGroup, error: createModuleGroupError } =
        await sbAdmin
          .from('workspace_course_module_groups')
          .insert(moduleGroupPayload)
          .select('id')
          .single();

      if (createModuleGroupError) {
        return NextResponse.json(
          {
            error: 'Failed to create a target module group.',
            message: createModuleGroupError.message,
          },
          { status: 500 }
        );
      }

      moduleGroupId = createdModuleGroup.id;
    }

    const { data: maxSortKeyModule, error: maxSortKeyError } = await sbAdmin
      .from('workspace_course_modules')
      .select('sort_key')
      .eq('group_id', groupId)
      .eq('module_group_id', moduleGroupId)
      .order('sort_key', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (maxSortKeyError) {
      console.error(
        'Failed to fetch existing course modules:',
        maxSortKeyError
      );
      return NextResponse.json(
        {
          error: 'Failed to persist generated modules.',
          message: maxSortKeyError.message,
        },
        { status: 500 }
      );
    }

    const startingSortKey = (maxSortKeyModule?.sort_key ?? -1) + 1;

    const insertPayload: TablesInsert<'workspace_course_modules'>[] =
      object.modules.map((module, index) => ({
        content: module.content,
        extra_content: {
          quiz_questions: module.quiz_questions ?? [],
          text: module.extra_content ?? null,
        },
        group_id: groupId,
        module_group_id: moduleGroupId,
        name: module.name,
        sort_key: startingSortKey + index,
      }));

    const { data: createdModules, error } = await sbAdmin
      .from('workspace_course_modules')
      .insert(insertPayload)
      .select('*');

    if (error) {
      console.error('Failed to insert AI generated modules:', error);
      return NextResponse.json(
        {
          data: object,
          error: 'Failed to save generated modules',
          message: error.message,
        },
        { status: 500 }
      );
    }

    // 6. Return the generated module data
    return NextResponse.json({
      data: object,
      createdModules,
      metadata: {
        title: markitdownResult.title,
        creditsCharged: markitdownResult.creditsCharged,
        truncated: markitdownResult.truncated,
      },
    });
  } catch (error) {
    console.error('Failed to generate course module:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
