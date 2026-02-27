import { google } from '@ai-sdk/google';
import { capMaxOutputTokensByCredits } from '@tuturuuu/ai/credits/cap-output-tokens';
import { checkAiCredits } from '@tuturuuu/ai/credits/check-credits';
import {
  createAdminClient,
  createClient,
  createDynamicClient,
} from '@tuturuuu/supabase/next/server';
import { MAX_CHAT_MESSAGE_LENGTH } from '@tuturuuu/utils/constants';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import type { ToolSet } from 'ai';
import {
  consumeStream,
  convertToModelMessages,
  gateway,
  type ModelMessage,
  smoothStream,
  stepCountIs,
  streamText,
  type TextPart,
} from 'ai';
import { type NextRequest, NextResponse } from 'next/server';
import { buildMiraContext } from '../../tools/context-builder';
import {
  createMiraStreamTools,
  type MiraToolContext,
} from '../../tools/mira-tools';
import {
  shouldForceGoogleSearchForLatestUserMessage,
  shouldForceRenderUiForLatestUserMessage,
  shouldPreferMarkdownTablesForLatestUserMessage,
} from '../mira-render-ui-policy';
import { buildMiraSystemInstruction } from '../mira-system-instruction';
import { ChatRequestBodySchema, mapToUIMessages } from './chat-request-schema';
import { systemInstruction } from './default-system-instruction';
import { processMessagesWithFiles } from './message-file-processing';
import { prepareMiraToolStep } from './mira-step-preparation';
import { persistAssistantResponse } from './stream-finish-persistence';

export const maxDuration = 60;
export const preferredRegion = 'sin1';

const DEFAULT_MODEL_NAME = 'google/gemini-2.5-flash';
const MAX_CONTEXT_MESSAGES = 10;
type ThinkingMode = 'fast' | 'thinking';
type CreditSource = 'workspace' | 'personal';
export function createPOST(
  _options: {
    serverAPIKeyFallback?: boolean;
    /** Gateway provider prefix for bare model names (e.g., 'openai', 'anthropic', 'vertex'). Defaults to 'google'. */
    defaultProvider?: string;
  } = {}
) {
  const defaultProvider = _options.defaultProvider ?? 'google';

  // Higher-order function that returns the actual request handler
  return async function handler(req: NextRequest): Promise<Response> {
    try {
      const sbAdmin = await createAdminClient();
      let requestBody: unknown;
      try {
        requestBody = await req.json();
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Invalid JSON payload',
            message:
              error instanceof Error ? error.message : 'Malformed JSON body',
          },
          { status: 400 }
        );
      }

      const parsedBody = ChatRequestBodySchema.safeParse(requestBody);
      if (!parsedBody.success) {
        return NextResponse.json(
          {
            error: 'Invalid request body',
            issues: parsedBody.error.issues,
          },
          { status: 400 }
        );
      }

      const {
        id,
        model = DEFAULT_MODEL_NAME,
        messages,
        wsId,
        isMiraMode,
        timezone,
        thinkingMode: rawThinkingMode,
        creditSource: requestedCreditSourceRaw,
        creditWsId: requestedCreditWsId,
      } = parsedBody.data;
      const thinkingMode: ThinkingMode =
        rawThinkingMode === 'thinking' ? 'thinking' : 'fast';
      if (!messages) {
        console.error('Missing messages');
        return new Response('Missing messages', { status: 400 });
      }

      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error('Unauthorized');
        return new Response('Unauthorized', { status: 401 });
      }

      if (wsId) {
        const { data: contextMembership } = await sbAdmin
          .from('workspace_members')
          .select('user_id')
          .eq('ws_id', wsId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!contextMembership) {
          return NextResponse.json(
            { error: 'Workspace access denied' },
            { status: 403 }
          );
        }
      }

      const requestedCreditSource: CreditSource =
        requestedCreditSourceRaw ?? 'workspace';
      let billingWsId: string | null = wsId ?? null;

      if (requestedCreditSource === 'personal') {
        const { data: personalWorkspace, error: personalWorkspaceError } =
          await sbAdmin
            .from('workspaces')
            .select('id, workspace_members!inner(user_id)')
            .eq('personal', true)
            .eq('workspace_members.user_id', user.id)
            .maybeSingle();

        if (personalWorkspaceError || !personalWorkspace?.id) {
          return NextResponse.json(
            {
              error:
                'Personal workspace not found. Please ensure your account has a personal workspace.',
              code: 'PERSONAL_WORKSPACE_NOT_FOUND',
            },
            { status: 403 }
          );
        }

        if (
          requestedCreditWsId &&
          requestedCreditWsId !== personalWorkspace.id
        ) {
          return NextResponse.json(
            {
              error:
                'Invalid credit workspace for personal credit source selection.',
              code: 'INVALID_CREDIT_SOURCE',
            },
            { status: 403 }
          );
        }

        billingWsId = personalWorkspace.id;
      } else if (requestedCreditWsId) {
        if (wsId && requestedCreditWsId !== wsId) {
          return NextResponse.json(
            {
              error: 'Invalid credit workspace for workspace source selection.',
              code: 'INVALID_CREDIT_SOURCE',
            },
            { status: 403 }
          );
        }

        if (!wsId) {
          const { data: billingMembership } = await sbAdmin
            .from('workspace_members')
            .select('user_id')
            .eq('ws_id', requestedCreditWsId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!billingMembership) {
            return NextResponse.json(
              {
                error: 'Workspace access denied for selected credit workspace.',
                code: 'INVALID_CREDIT_SOURCE',
              },
              { status: 403 }
            );
          }

          billingWsId = requestedCreditWsId;
        }
      }

      let chatId = id;

      if (!chatId) {
        const { data, error } = await sbAdmin
          .from('ai_chats')
          .select('id')
          .eq('creator_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error(error.message);
          return new Response(error.message, { status: 500 });
        }

        if (!data)
          return new Response('Internal Server Error', { status: 500 });

        chatId = data.id;
      }

      // if thread does not have any messages, move files from temp to thread
      const { data: thread, error: threadError } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('chat_id', chatId);

      if (threadError) {
        console.error('Error getting thread:', threadError);
        return new Response(threadError.message, { status: 500 });
      }

      const sbDynamic = await createDynamicClient();

      if (thread && thread.length === 1 && thread[0]?.role === 'USER') {
        // Move files from temp to thread
        const tempStoragePath = `${wsId}/chats/ai/resources/temp/${user.id}`;
        const { data: files, error: listError } = await sbDynamic.storage
          .from('workspaces')
          .list(tempStoragePath);

        if (listError) {
          console.error('Error getting files:', listError);
        }

        if (files && files.length > 0) {
          await Promise.all(
            files.map(async (file) => {
              const fileName = file.name;

              const { error: copyError } = await sbAdmin.storage
                .from('workspaces')
                .move(
                  `${tempStoragePath}/${fileName}`,
                  `${wsId}/chats/ai/resources/${chatId}/${fileName}`
                );

              if (copyError) {
                console.error('File copy error:', { fileName, copyError });
              }
            })
          );
        }
      }

      const normalizedMessages = mapToUIMessages(messages);

      // Convert UIMessages to ModelMessages
      const modelMessages = await convertToModelMessages(normalizedMessages);

      // Validate message content length
      for (const message of modelMessages) {
        if (
          typeof message.content === 'string' &&
          message.content.length > MAX_CHAT_MESSAGE_LENGTH
        ) {
          return new Response(
            `Message too long (max ${MAX_CHAT_MESSAGE_LENGTH} characters)`,
            { status: 400 }
          );
        }

        if (Array.isArray(message.content)) {
          for (const part of message.content) {
            if (
              part.type === 'text' &&
              part.text.length > MAX_CHAT_MESSAGE_LENGTH
            ) {
              return new Response(
                `Message too long (max ${MAX_CHAT_MESSAGE_LENGTH} characters)`,
                { status: 400 }
              );
            }
          }
        }
      }

      // Process messages and handle file attachments
      let processedMessages =
        wsId && chatId
          ? await processMessagesWithFiles(modelMessages, wsId, chatId)
          : modelMessages;

      // Limit the number of messages sent to the AI to prevent context overflow and save credits
      if (processedMessages.length > MAX_CONTEXT_MESSAGES) {
        const systemMessages = processedMessages.filter(
          (message) => message.role === 'system'
        );
        const nonSystemMessages = processedMessages.filter(
          (message) => message.role !== 'system'
        );
        const allowedNonSystemCount = Math.max(
          MAX_CONTEXT_MESSAGES - systemMessages.length,
          0
        );
        processedMessages = [
          ...systemMessages,
          ...nonSystemMessages.slice(-allowedNonSystemCount),
        ];
        console.info('Truncated processed chat context', {
          originalLength: systemMessages.length + nonSystemMessages.length,
          resultingLength: processedMessages.length,
          preservedSystemMessages: systemMessages.length,
        });
      }

      if (processedMessages.length !== 1) {
        const userMessages = processedMessages.filter(
          (msg: ModelMessage) => msg.role === 'user'
        );

        const lastMessage = userMessages[userMessages.length - 1];
        let messageContent: string;

        if (typeof lastMessage?.content === 'string') {
          messageContent = lastMessage.content;
        } else if (Array.isArray(lastMessage?.content)) {
          // Extract text content from complex message structure
          messageContent = lastMessage.content
            .filter((part): part is TextPart => part.type === 'text')
            .map((part) => part.text)
            .join('\n');
        } else {
          messageContent = 'Message with attachments';
        }

        if (!messageContent) {
          console.log('No message found');
          throw new Error('No message found');
        }

        const { error: insertMsgError } = await supabase.rpc(
          'insert_ai_chat_message',
          {
            message: messageContent,
            chat_id: chatId,
            source: isMiraMode ? 'Mira' : 'Rewise',
          }
        );

        if (insertMsgError) {
          console.log('ERROR ORIGIN: ROOT START');
          console.log(insertMsgError);
          throw new Error(insertMsgError.message);
        }

        console.log('User message saved to database');
      }

      // Pre-flight AI credit check
      const creditCheck = billingWsId
        ? await checkAiCredits(billingWsId, model, 'chat', { userId: user.id })
        : null;
      if (creditCheck && !creditCheck.allowed) {
        return NextResponse.json(
          {
            error: creditCheck.errorMessage || 'AI credits insufficient',
            code: creditCheck.errorCode,
          },
          { status: 403 }
        );
      }

      // Apply credit-budget cap on maxOutputTokens (defense-in-depth)
      const cappedMaxOutput = creditCheck
        ? await capMaxOutputTokensByCredits(
            sbAdmin,
            model,
            creditCheck.maxOutputTokens,
            creditCheck.remainingCredits
          )
        : null;
      if (
        cappedMaxOutput === null &&
        creditCheck &&
        creditCheck.remainingCredits <= 0
      ) {
        return NextResponse.json(
          { error: 'AI credits insufficient', code: 'CREDITS_EXHAUSTED' },
          { status: 403 }
        );
      }

      // Build Mira context + tools if in Mira mode
      let miraSystemPrompt: string | undefined;
      let miraTools: ToolSet | undefined;

      if (isMiraMode && wsId) {
        let withoutPermission: ((p: any) => boolean) | undefined;
        try {
          const permissionsResult = await getPermissions({
            wsId,
            request: req,
          });
          if (permissionsResult) {
            withoutPermission = permissionsResult.withoutPermission;
          }
        } catch (permErr) {
          console.error('Failed to get permissions for Mira tools:', permErr);
        }

        const ctx: MiraToolContext = {
          userId: user.id,
          wsId,
          creditWsId: billingWsId ?? wsId,
          chatId,
          supabase,
          timezone,
        };
        try {
          const { contextString, soul, isFirstInteraction } =
            await buildMiraContext(ctx);
          const dynamicInstruction = buildMiraSystemInstruction({
            soul,
            isFirstInteraction,
            withoutPermission,
          });
          miraSystemPrompt = `${contextString}\n\n${dynamicInstruction}`;
        } catch (ctxErr) {
          console.error(
            'Failed to build Mira context (continuing with default instruction):',
            ctxErr
          );
          miraSystemPrompt = buildMiraSystemInstruction({ withoutPermission });
        }
        miraTools = createMiraStreamTools(ctx, withoutPermission);
      }

      const effectiveSource = isMiraMode ? 'Mira' : 'Rewise';

      const resolvedGatewayModel = model.includes('/')
        ? gateway(model)
        : gateway(`${defaultProvider}/${model}`);

      // Reasoning mode: default to fast unless the client explicitly requests thinking.
      const modelLower = model.toLowerCase();
      const supportsThinking =
        modelLower.includes('gemini-2.5') || modelLower.includes('gemini-3');
      const thinkingConfig = supportsThinking
        ? thinkingMode === 'thinking'
          ? { thinkingConfig: { includeThoughts: true } }
          : {
              thinkingConfig: {
                thinkingBudget: 0,
                includeThoughts: false,
              },
            }
        : {};
      const forceRenderUi =
        shouldForceRenderUiForLatestUserMessage(processedMessages);
      const forceGoogleSearch =
        shouldForceGoogleSearchForLatestUserMessage(processedMessages);
      const preferMarkdownTables =
        shouldPreferMarkdownTablesForLatestUserMessage(processedMessages);

      // Provider-native Google Search tool for non-Mira mode.
      const googleSearchTool = {
        google_search: google.tools.googleSearch({}),
      };

      type PrepareStep = NonNullable<
        NonNullable<Parameters<typeof streamText>[0]>['prepareStep']
      >;
      const prepareStep: PrepareStep = ({ steps }) =>
        prepareMiraToolStep({
          steps,
          forceGoogleSearch,
          forceRenderUi,
          preferMarkdownTables,
        });

      const result = streamText({
        abortSignal: req.signal,
        experimental_transform: smoothStream(),
        model: resolvedGatewayModel,
        messages: processedMessages,
        system:
          isMiraMode && miraSystemPrompt ? miraSystemPrompt : systemInstruction,
        ...(cappedMaxOutput ? { maxOutputTokens: cappedMaxOutput } : {}),
        ...(miraTools
          ? {
              tools: miraTools,
              stopWhen: stepCountIs(25),
              toolChoice: 'auto' as const,
              prepareStep,
            }
          : {
              tools: googleSearchTool,
            }),
        providerOptions: {
          google: {
            ...thinkingConfig,
            safetySettings: [
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_NONE',
              },
            ],
          },
          vertex: {
            ...thinkingConfig,
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE',
              },
            ],
          },
          gateway: {
            order: ['vertex', 'google'],
            caching: 'auto',
          },
        },
        onFinish: async (response) =>
          persistAssistantResponse({
            response,
            sbAdmin,
            chatId,
            userId: user.id,
            model,
            effectiveSource,
            wsId: billingWsId ?? undefined,
          }),
      });

      // Per https://ai-sdk.dev/docs/advanced/stopping-streams: consumeSseStream ensures
      // the stream is consumed on abort so cleanup can run; use onFinish in toUIMessageStreamResponse
      // to handle isAborted when needed.
      return result.toUIMessageStreamResponse({
        consumeSseStream: consumeStream,
        sendReasoning: true,
        sendSources: true,
      });
    } catch (error) {
      if (error instanceof Error) {
        console.log(error.message);
        return NextResponse.json(
          {
            message: `## Edge API Failure\nCould not complete the request. Please view the **Stack trace** below.\n\`\`\`bash\n${error instanceof Error ? error.stack : 'Unknown error'}\n\`\`\``,
          },
          {
            status: 500,
          }
        );
      }
      console.log(error);
      return new Response('Internal Server Error', { status: 500 });
    }
  };
}
