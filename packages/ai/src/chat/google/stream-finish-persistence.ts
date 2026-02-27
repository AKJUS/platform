import { deductAiCredits } from '@tuturuuu/ai/credits/check-credits';

type UsageLike = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
};

type GroundingMetadataLike = {
  webSearchQueries?: string[];
};

type GoogleProviderMetadataLike = {
  groundingMetadata?: GroundingMetadataLike;
};

type ProviderMetadataLike = {
  google?: GoogleProviderMetadataLike;
};

type ToolCallLike = {
  toolName?: string;
} & Record<string, unknown>;

type ToolResultLike = Record<string, unknown>;

type SourceLike = {
  sourceId?: string;
  url?: string;
  title?: string;
};

type StepLike = {
  toolCalls?: ToolCallLike[];
  toolResults?: ToolResultLike[];
  usage?: UsageLike;
  providerMetadata?: ProviderMetadataLike;
  sources?: unknown[];
  reasoningText?: string;
};

type StreamFinishResponseLike = {
  text?: string;
  finishReason?: string;
  usage?: UsageLike;
  totalUsage?: UsageLike;
  steps?: StepLike[];
  providerMetadata?: ProviderMetadataLike;
  reasoningText?: string;
  sources?: SourceLike[];
};

type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
};

type InsertedMessage = {
  id?: string;
};

type InsertResult = PromiseLike<{
  data: InsertedMessage | null;
  error: { message: string } | null;
}>;

type AdminClientLike = {
  from: (table: 'ai_chat_messages') => {
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => InsertResult;
      };
    };
  };
};

type PersistAssistantResponseParams = {
  response: StreamFinishResponseLike;
  sbAdmin: AdminClientLike;
  chatId: string;
  userId: string;
  model: string;
  effectiveSource: 'Mira' | 'Rewise';
  wsId?: string;
};

function collectToolData(steps: StepLike[]) {
  const allToolCalls = steps.flatMap((step) => step.toolCalls ?? []);
  const allToolResults = steps.flatMap((step) => step.toolResults ?? []);
  return { allToolCalls, allToolResults };
}

function collectReasoningText(response: StreamFinishResponseLike): string {
  const allReasoning = (response.steps ?? [])
    .map((step) => step.reasoningText)
    .filter(Boolean)
    .join('\n\n');

  return allReasoning || response.reasoningText || '';
}

function collectUsageTotals(response: StreamFinishResponseLike): UsageTotals {
  const usage = response.totalUsage ?? response.usage ?? {};
  let inputTokens = usage.inputTokens ?? 0;
  let outputTokens = usage.outputTokens ?? 0;
  let reasoningTokens = usage.reasoningTokens ?? 0;

  if (
    inputTokens === 0 &&
    outputTokens === 0 &&
    reasoningTokens === 0 &&
    (response.steps?.length ?? 0) > 0
  ) {
    for (const step of response.steps ?? []) {
      const stepUsage = step.usage;
      if (!stepUsage) continue;

      inputTokens += stepUsage.inputTokens ?? 0;
      outputTokens += stepUsage.outputTokens ?? 0;
      reasoningTokens += stepUsage.reasoningTokens ?? 0;
    }
  }

  return { inputTokens, outputTokens, reasoningTokens };
}

function collectSerializableSources(response: StreamFinishResponseLike) {
  if (!response.sources?.length) return [];

  return response.sources.map((source) => ({
    sourceId: source.sourceId,
    url: source.url,
    title: source.title,
  }));
}

function logGoogleSearchDebug(response: StreamFinishResponseLike): void {
  console.log('[Google Search Debug] response keys:', Object.keys(response));
  console.log(
    '[Google Search Debug] providerMetadata:',
    JSON.stringify(response.providerMetadata, null, 2)?.slice(0, 500)
  );
  console.log(
    '[Google Search Debug] sources:',
    JSON.stringify(response.sources, null, 2)?.slice(0, 500)
  );

  if (!response.steps?.length) return;

  for (let stepIndex = 0; stepIndex < response.steps.length; stepIndex++) {
    const step = response.steps[stepIndex];
    console.log(
      `[Google Search Debug] step[${stepIndex}] providerMetadata:`,
      JSON.stringify(step?.providerMetadata, null, 2)?.slice(0, 500)
    );
    console.log(
      `[Google Search Debug] step[${stepIndex}] sources:`,
      JSON.stringify(step?.sources, null, 2)?.slice(0, 500)
    );
  }
}

function countGoogleSearchQueries(
  response: StreamFinishResponseLike,
  allToolCalls: ToolCallLike[]
): number {
  const customGoogleSearchCalls = allToolCalls.filter(
    (toolCall) => toolCall.toolName === 'google_search'
  ).length;
  if (customGoogleSearchCalls > 0) return customGoogleSearchCalls;

  const topQueries =
    response.providerMetadata?.google?.groundingMetadata?.webSearchQueries;
  if (topQueries?.length) return topQueries.length;

  let perStepQueriesCount = 0;
  for (const step of response.steps ?? []) {
    const stepQueries =
      step.providerMetadata?.google?.groundingMetadata?.webSearchQueries;
    if (stepQueries?.length) {
      perStepQueriesCount += stepQueries.length;
    }
  }
  if (perStepQueriesCount > 0) return perStepQueriesCount;

  if (Array.isArray(response.sources) && response.sources.length > 0) {
    return 1;
  }

  return 0;
}

export async function persistAssistantResponse({
  response,
  sbAdmin,
  chatId,
  userId,
  model,
  effectiveSource,
  wsId,
}: PersistAssistantResponseParams): Promise<void> {
  const steps = response.steps ?? [];
  const { allToolCalls, allToolResults } = collectToolData(steps);

  if (!response.text && allToolCalls.length === 0) {
    console.warn('onFinish: no text and no tool calls — skipping DB save');
    return;
  }

  const reasoningText = collectReasoningText(response);
  const { inputTokens, outputTokens, reasoningTokens } =
    collectUsageTotals(response);
  const serializedSources = collectSerializableSources(response);

  const { data: messageData, error } = await sbAdmin
    .from('ai_chat_messages')
    .insert({
      chat_id: chatId,
      creator_id: userId,
      content: response.text || '',
      role: 'ASSISTANT',
      model: (model.includes('/')
        ? model.split('/').pop()!
        : model
      ).toLowerCase(),
      finish_reason: response.finishReason,
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      metadata: {
        source: effectiveSource,
        ...(reasoningText ? { reasoning: reasoningText } : {}),
        ...(allToolCalls.length
          ? { toolCalls: JSON.parse(JSON.stringify(allToolCalls)) }
          : {}),
        ...(allToolResults.length
          ? { toolResults: JSON.parse(JSON.stringify(allToolResults)) }
          : {}),
        ...(serializedSources.length ? { sources: serializedSources } : {}),
      },
    })
    .select('id')
    .single();

  if (error) {
    console.log('ERROR ORIGIN: ROOT COMPLETION');
    console.log(error);
    throw new Error(error.message);
  }

  console.log('AI Response saved to database');
  logGoogleSearchDebug(response);

  const searchCount = countGoogleSearchQueries(response, allToolCalls);
  if (searchCount > 0) {
    console.log(
      `Google Search grounding detected: ${searchCount} search quer${searchCount === 1 ? 'y' : 'ies'}`
    );
  }

  if (
    wsId &&
    (inputTokens > 0 ||
      outputTokens > 0 ||
      reasoningTokens > 0 ||
      searchCount > 0)
  ) {
    deductAiCredits({
      wsId,
      userId,
      modelId: model,
      inputTokens,
      outputTokens,
      reasoningTokens,
      feature: 'chat',
      chatMessageId: messageData?.id,
      ...(searchCount > 0 ? { searchCount } : {}),
    }).catch((error) => console.error('Failed to deduct AI credits:', error));
  }
}
