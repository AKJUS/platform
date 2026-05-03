import { NextResponse } from 'next/server';
import { readCronMonitoringSnapshot } from '@/lib/infrastructure/cron-monitoring';
import { serverLogger } from '@/lib/infrastructure/log-drain';
import { authorizeInfrastructureViewer } from '../blue-green/authorization';

export async function GET(request: Request) {
  const authorization = await authorizeInfrastructureViewer(request);
  if (!authorization.ok) {
    return authorization.response;
  }

  try {
    return NextResponse.json(readCronMonitoringSnapshot());
  } catch (error) {
    serverLogger.error('Failed to load cron monitoring snapshot:', error);
    return NextResponse.json(
      { message: 'Failed to load cron monitoring snapshot' },
      { status: 500 }
    );
  }
}
