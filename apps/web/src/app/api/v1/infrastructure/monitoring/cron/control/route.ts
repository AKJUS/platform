import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateCronMonitoringControl } from '@/lib/infrastructure/cron-monitoring';
import { serverLogger } from '@/lib/infrastructure/log-drain';
import { authorizeInfrastructureViewer } from '../../blue-green/authorization';

const payloadSchema = z.object({
  enabled: z.boolean(),
});

export async function PUT(request: Request) {
  const authorization = await authorizeInfrastructureViewer(request);
  if (!authorization.ok) {
    return authorization.response;
  }

  try {
    const payload = payloadSchema.parse(await request.json());
    const control = updateCronMonitoringControl({
      enabled: payload.enabled,
      updatedBy: authorization.user.id,
      updatedByEmail: authorization.user.email ?? null,
    });

    return NextResponse.json({
      control,
      message: payload.enabled
        ? 'Enabled native cron execution.'
        : 'Disabled native cron execution.',
    });
  } catch (error) {
    serverLogger.error('Failed to update cron monitoring control:', error);
    return NextResponse.json(
      { message: 'Failed to update cron monitoring control' },
      { status: 500 }
    );
  }
}
