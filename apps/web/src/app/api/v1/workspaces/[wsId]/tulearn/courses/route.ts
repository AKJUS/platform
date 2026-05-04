import { createAdminClient } from '@tuturuuu/supabase/next/server';
import { NextResponse } from 'next/server';
import { withSessionAuth } from '@/lib/api-auth';
import { serverLogger } from '@/lib/infrastructure/log-drain';
import {
  getLearnerCourseSummaries,
  resolveTulearnSubject,
} from '@/lib/tulearn/service';

type Params = {
  wsId: string;
};

export const GET = withSessionAuth<Params>(
  async (request, { supabase, user }, { wsId }) => {
    try {
      const subject = await resolveTulearnSubject({
        requestSupabase: supabase,
        studentId: request.nextUrl.searchParams.get('studentId'),
        user,
        wsId,
      });

      if (subject instanceof Response) return subject as NextResponse;

      const courses = await getLearnerCourseSummaries({
        db: await createAdminClient(),
        studentPlatformUserId: subject.studentPlatformUserId,
        studentWorkspaceUserId: subject.studentWorkspaceUserId,
        wsId: subject.wsId,
      });

      return NextResponse.json({ courses });
    } catch (error) {
      serverLogger.error('Failed to list Tulearn courses:', error);
      return NextResponse.json(
        { message: 'Failed to load courses' },
        { status: 500 }
      );
    }
  }
);
