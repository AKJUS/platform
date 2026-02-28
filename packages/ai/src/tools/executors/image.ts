import type { MiraToolContext } from '../mira-tools';

const IMAGEN_4_FAST = 'google/imagen-4.0-fast-generate-001';
const IMAGEN_4 = 'google/imagen-4.0-generate-001';

export async function executeGenerateImage(
  args: Record<string, unknown>,
  ctx: MiraToolContext
): Promise<unknown> {
  const billingWsId = ctx.creditWsId ?? ctx.wsId;
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
  const {
    commitFixedAiCreditReservation,
    releaseFixedAiCreditReservation,
    reserveFixedAiCredits,
  } = await import('../../credits/reservations');
  let commitResult: Awaited<
    ReturnType<typeof commitFixedAiCreditReservation>
  > | null = null;
  const { createAdminClient } = await import('@tuturuuu/supabase/next/server');
  const creditCheck = await checkAiCredits(
    billingWsId,
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

  const sbAdmin = await createAdminClient();
  const reservationMetadata = {
    prompt,
    aspectRatio,
    model: selectedModel,
    feature: 'image_generation',
  };

  const reservation = await reserveFixedAiCredits(
    {
      wsId: billingWsId,
      userId: ctx.userId,
      amount: 1,
      modelId: selectedModel,
      feature: 'image_generation',
      metadata: reservationMetadata,
    },
    sbAdmin
  );

  if (!reservation.success || !reservation.reservationId) {
    return {
      success: false,
      error:
        reservation.errorCode === 'INSUFFICIENT_CREDITS'
          ? 'You have run out of AI credits for image generation.'
          : 'Failed to reserve AI credits for image generation.',
    };
  }

  const { generateImage, gateway } = await import('ai');

  const imageId = crypto.randomUUID();
  const storagePath = `${ctx.wsId}/mira/images/${imageId}.png`;

  try {
    const { image } = await generateImage({
      model: gateway.image(selectedModel),
      prompt,
      aspectRatio: aspectRatio as `${number}:${number}`,
    });

    const { error: uploadError } = await sbAdmin.storage
      .from('workspaces')
      .upload(storagePath, image.uint8Array, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: urlData, error: urlError } = await sbAdmin.storage
      .from('workspaces')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 30);

    if (urlError || !urlData) {
      throw new Error(
        `Signed URL failed: ${urlError?.message ?? 'No data returned'}`
      );
    }

    commitResult = await commitFixedAiCreditReservation(
      reservation.reservationId,
      {
        ...reservationMetadata,
        storagePath,
      },
      sbAdmin
    );

    if (!commitResult.success) {
      throw new Error('Failed to finalize AI credit deduction.');
    }

    return {
      success: true,
      imageUrl: urlData.signedUrl,
      storagePath,
      prompt,
    };
  } catch (error) {
    let commitOrReleaseError: Error | null = null;
    if (storagePath) {
      const { error: removeError } = await sbAdmin.storage
        .from('workspaces')
        .remove([storagePath]);
      if (removeError) {
        console.error('Failed to cleanup image upload', {
          storagePath,
          error: removeError.message,
        });
      }
    }

    const releaseResult = await releaseFixedAiCreditReservation(
      reservation.reservationId,
      {
        ...reservationMetadata,
        storagePath,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown image generation error',
      },
      sbAdmin
    );

    if (
      !releaseResult.success &&
      releaseResult.errorCode === 'RESERVATION_ALREADY_COMMITTED'
    ) {
      console.error('Reservation already committed after failure', {
        commitResult,
        releaseResult,
        storagePath,
      });
      commitOrReleaseError = new Error(
        `AI credit reservation already committed after failure: ${JSON.stringify(
          {
            commitResult,
            releaseResult,
          }
        )}`
      );
    }

    return {
      success: false,
      error: commitOrReleaseError?.message
        ? `${commitOrReleaseError.message} ${
            error instanceof Error ? `Original error: ${error.message}` : ''
          }`.trim()
        : error instanceof Error
          ? error.message
          : 'Image generation failed. Please try again.',
    };
  }
}
