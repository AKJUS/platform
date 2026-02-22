import type { MiraToolContext } from '../mira-tools';

const IMAGEN_4_FAST = 'google/imagen-4.0-fast-generate-001';
const IMAGEN_4 = 'google/imagen-4.0-generate-001';

export async function executeGenerateImage(
  args: Record<string, unknown>,
  ctx: MiraToolContext
): Promise<unknown> {
  const prompt = args.prompt as string;
  const aspectRatio = (args.aspectRatio as string) ?? '1:1';

  const resolvedModel =
    (args.model as string) ??
    (await (async () => {
      const { getWorkspaceTier } = await import(
        '@tuturuuu/utils/workspace-helper'
      );
      const tier = await getWorkspaceTier(ctx.wsId, { useAdmin: true });
      return tier === 'FREE' ? IMAGEN_4_FAST : IMAGEN_4;
    })());
  const selectedModel = resolvedModel;

  const { checkAiCredits } = await import('../../credits/check-credits');
  const creditCheck = await checkAiCredits(
    ctx.wsId,
    selectedModel,
    'image_generation',
    { userId: ctx.userId }
  );

  if (!creditCheck.allowed) {
    const errorMessages: Record<string, string> = {
      FEATURE_NOT_ALLOWED:
        'Image generation is not available on your current plan.',
      MODEL_NOT_ALLOWED: `The model ${selectedModel} is not enabled for your workspace.`,
      CREDITS_EXHAUSTED: 'You have run out of AI credits for image generation.',
      NO_ALLOCATION: 'Image generation is not configured for your workspace.',
    };
    return {
      success: false,
      error:
        errorMessages[creditCheck.errorCode ?? ''] ??
        'Image generation is not available. Please check your AI credit settings.',
    };
  }

  const { generateImage, gateway } = await import('ai');
  const { createAdminClient } = await import('@tuturuuu/supabase/next/server');

  const { image } = await generateImage({
    model: gateway.image(selectedModel),
    prompt,
    aspectRatio: aspectRatio as `${number}:${number}`,
  });

  const sbAdmin = await createAdminClient();
  const imageId = crypto.randomUUID();
  const storagePath = `${ctx.wsId}/mira/images/${imageId}.png`;

  const { error: uploadError } = await sbAdmin.storage
    .from('workspaces')
    .upload(storagePath, image.uint8Array, {
      contentType: 'image/png',
      upsert: false,
    });

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` };
  }

  const { data: urlData, error: urlError } = await sbAdmin.storage
    .from('workspaces')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 30);

  if (urlError || !urlData) {
    return {
      success: false,
      error: `Signed URL failed: ${urlError?.message ?? 'No data returned'}`,
    };
  }

  const { deductAiCredits } = await import('../../credits/check-credits');
  void deductAiCredits({
    wsId: ctx.wsId,
    userId: ctx.userId,
    modelId: selectedModel,
    inputTokens: 0,
    outputTokens: 0,
    imageCount: 1,
    feature: 'image_generation',
    metadata: {
      prompt,
      aspectRatio,
      storagePath,
      model: selectedModel,
    },
  }).catch((err: unknown) =>
    console.error('Image credit deduction failed:', err)
  );

  return {
    success: true,
    imageUrl: urlData.signedUrl,
    storagePath,
    prompt,
  };
}
