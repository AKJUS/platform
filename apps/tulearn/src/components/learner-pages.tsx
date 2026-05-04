'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Check,
  Flame,
  Heart,
  LineChart,
  Moon,
  Sparkles,
  Sun,
  Trophy,
} from '@tuturuuu/icons';
import {
  completeTulearnAssignment,
  getTulearnBootstrap,
  getTulearnHome,
  getTulearnPractice,
  listTulearnAssignments,
  listTulearnCourses,
  listTulearnMarks,
  listTulearnReports,
  submitTulearnPractice,
  type TulearnAssignmentSummary,
  type TulearnCourseSummary,
  type TulearnMarkSummary,
  type TulearnReportSummary,
} from '@tuturuuu/internal-api';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@tuturuuu/ui/card';
import { Input } from '@tuturuuu/ui/input';
import { Label } from '@tuturuuu/ui/label';
import { Progress } from '@tuturuuu/ui/progress';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { type ReactNode, useState } from 'react';

function useStudentId() {
  return useSearchParams().get('studentId');
}

function LoadingState() {
  const t = useTranslations();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div
          className="h-36 animate-pulse rounded-2xl border border-border bg-muted/40"
          key={item}
        />
      ))}
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border border-dashed bg-muted/20 p-8 text-center text-muted-foreground">
      {label}
    </div>
  );
}

export function HomePage({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const studentId = useStudentId();
  const home = useQuery({
    queryFn: () => getTulearnHome(wsId, studentId),
    queryKey: ['tulearn', wsId, studentId, 'home'],
  });

  if (home.isLoading) return <LoadingState />;
  if (!home.data) return <EmptyState label={t('common.empty')} />;

  const state = home.data.state;
  const nextCourse = home.data.courses[0];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-dynamic-green/20 bg-linear-to-br from-dynamic-green/15 via-background to-dynamic-blue/10 p-6 md:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <Badge className="mb-4 bg-dynamic-green/15 text-dynamic-green hover:bg-dynamic-green/15">
              {t('home.dailyGoal')}
            </Badge>
            <h1 className="font-bold text-4xl tracking-normal">
              {t('home.title')}, {home.data.student.name}
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              {home.data.recommendedPractice?.title ?? t('practice.empty')}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Metric
              icon={Sparkles}
              label={t('home.xp')}
              value={state.xp_total}
            />
            <Metric
              icon={Flame}
              label={t('home.streak')}
              value={state.current_streak}
            />
            <Metric
              icon={Heart}
              label={t('home.hearts')}
              value={`${state.hearts}/${state.max_hearts}`}
            />
          </div>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t('home.nextLesson')}</CardTitle>
          </CardHeader>
          <CardContent>
            {nextCourse ? (
              <CourseCard course={nextCourse} />
            ) : (
              <EmptyState label={t('courses.empty')} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('home.assignments')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {home.data.assignments.slice(0, 3).map((assignment) => (
              <AssignmentRow
                assignment={assignment}
                completedLabel={t('common.completed')}
                key={assignment.id}
              />
            ))}
            {!home.data.assignments.length ? (
              <EmptyState label={t('assignments.empty')} />
            ) : null}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('home.marks')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {home.data.marks.slice(0, 6).map((mark) => (
            <MarkCard key={mark.id} mark={mark} />
          ))}
          {!home.data.marks.length ? (
            <EmptyState label={t('marks.empty')} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-24 rounded-2xl border border-border/70 bg-background/80 p-4">
      <Icon className="mx-auto mb-2 h-5 w-5 text-dynamic-green" />
      <p className="font-bold text-2xl">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

export function CoursesPage({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const studentId = useStudentId();
  const courses = useQuery({
    queryFn: () => listTulearnCourses(wsId, studentId),
    queryKey: ['tulearn', wsId, studentId, 'courses'],
  });

  if (courses.isLoading) return <LoadingState />;

  return (
    <Section title={t('courses.title')}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {courses.data?.courses.map((course) => (
          <CourseCard course={course} key={course.id} />
        ))}
      </div>
      {!courses.data?.courses.length ? (
        <EmptyState label={t('courses.empty')} />
      ) : null}
    </Section>
  );
}

function CourseCard({ course }: { course: TulearnCourseSummary }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <BookOpen className="mb-4 h-6 w-6 text-dynamic-blue" />
      <h3 className="font-semibold text-lg">{course.name}</h3>
      <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">
        {course.description}
      </p>
      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>
            {course.completedModules}/{course.totalModules}
          </span>
          <span>{course.progress}%</span>
        </div>
        <Progress value={course.progress} />
      </div>
    </div>
  );
}

export function PracticePage({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const studentId = useStudentId();
  const queryClient = useQueryClient();
  const practice = useQuery({
    queryFn: () => getTulearnPractice(wsId, studentId),
    queryKey: ['tulearn', wsId, studentId, 'practice'],
  });
  const submit = useMutation({
    mutationFn: (correct: boolean) =>
      practice.data?.item
        ? submitTulearnPractice(
            wsId,
            {
              correct,
              itemId: practice.data.item.id,
              type: practice.data.item.type,
            },
            studentId
          )
        : Promise.reject(new Error('No practice item')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tulearn', wsId, studentId] });
    },
  });

  if (practice.isLoading) return <LoadingState />;
  if (!practice.data?.item) return <EmptyState label={t('practice.empty')} />;

  return (
    <Section title={t('practice.title')}>
      <div className="mx-auto max-w-2xl rounded-3xl border border-dynamic-green/20 bg-card p-6 shadow-sm">
        <Badge className="mb-4 bg-dynamic-blue/15 text-dynamic-blue hover:bg-dynamic-blue/15">
          {practice.data.item.courseName}
        </Badge>
        <h2 className="font-bold text-3xl tracking-normal">
          {practice.data.item.title}
        </h2>
        <p className="mt-4 text-muted-foreground">
          {practice.data.item.prompt ?? t('practice.title')}
        </p>
        {submit.data ? (
          <div className="mt-6 rounded-2xl border border-dynamic-green/20 bg-dynamic-green/10 p-4">
            <p className="font-semibold">
              {submit.data.correct
                ? t('practice.correct')
                : t('practice.incorrect')}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('practice.xpAwarded')}: {submit.data.xpAwarded}
            </p>
          </div>
        ) : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button
            className="bg-dynamic-green text-white hover:bg-dynamic-green/90"
            disabled={submit.isPending}
            onClick={() => submit.mutate(true)}
          >
            <Check className="h-4 w-4" />
            {t('practice.submitCorrect')}
          </Button>
          <Button
            disabled={submit.isPending}
            onClick={() => submit.mutate(false)}
            variant="secondary"
          >
            {t('practice.submitIncorrect')}
          </Button>
        </div>
      </div>
    </Section>
  );
}

export function AssignmentsPage({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const studentId = useStudentId();
  const queryClient = useQueryClient();
  const assignments = useQuery({
    queryFn: () => listTulearnAssignments(wsId, studentId),
    queryKey: ['tulearn', wsId, studentId, 'assignments'],
  });
  const complete = useMutation({
    mutationFn: (postId: string) =>
      completeTulearnAssignment(wsId, { completed: true, postId }, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tulearn', wsId, studentId, 'assignments'],
      });
      queryClient.invalidateQueries({
        queryKey: ['tulearn', wsId, studentId, 'home'],
      });
    },
  });

  if (assignments.isLoading) return <LoadingState />;

  return (
    <Section title={t('assignments.title')}>
      <div className="space-y-3">
        {assignments.data?.assignments.map((assignment) => (
          <AssignmentRow
            action={
              !assignment.is_completed ? (
                <Button
                  disabled={complete.isPending}
                  onClick={() => complete.mutate(assignment.id)}
                  size="sm"
                >
                  {t('assignments.markDone')}
                </Button>
              ) : null
            }
            assignment={assignment}
            completedLabel={t('common.completed')}
            key={assignment.id}
          />
        ))}
      </div>
      {!assignments.data?.assignments.length ? (
        <EmptyState label={t('assignments.empty')} />
      ) : null}
    </Section>
  );
}

function AssignmentRow({
  action,
  assignment,
  completedLabel,
}: {
  action?: ReactNode;
  assignment: TulearnAssignmentSummary;
  completedLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{assignment.title}</h3>
          {assignment.is_completed ? (
            <Badge className="bg-dynamic-green/15 text-dynamic-green hover:bg-dynamic-green/15">
              {completedLabel}
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">
          {assignment.course.name}
        </p>
      </div>
      {action}
    </div>
  );
}

export function ReportsPage({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const studentId = useStudentId();
  const reports = useQuery({
    queryFn: () => listTulearnReports(wsId, studentId),
    queryKey: ['tulearn', wsId, studentId, 'reports'],
  });

  if (reports.isLoading) return <LoadingState />;

  return (
    <Section title={t('reports.title')}>
      <div className="grid gap-4 md:grid-cols-2">
        {reports.data?.reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
      {!reports.data?.reports.length ? (
        <EmptyState label={t('reports.empty')} />
      ) : null}
    </Section>
  );
}

function ReportCard({ report }: { report: TulearnReportSummary }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <LineChart className="mb-4 h-6 w-6 text-dynamic-purple" />
      <h3 className="font-semibold text-lg">{report.title}</h3>
      <p className="mt-2 line-clamp-4 text-muted-foreground text-sm">
        {report.feedback || report.content}
      </p>
      {report.score != null ? (
        <Badge className="mt-4 bg-dynamic-green/15 text-dynamic-green hover:bg-dynamic-green/15">
          {report.score}
        </Badge>
      ) : null}
    </div>
  );
}

export function MarksPage({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const studentId = useStudentId();
  const marks = useQuery({
    queryFn: () => listTulearnMarks(wsId, studentId),
    queryKey: ['tulearn', wsId, studentId, 'marks'],
  });

  if (marks.isLoading) return <LoadingState />;

  return (
    <Section title={t('marks.title')}>
      <div className="grid gap-4 md:grid-cols-3">
        {marks.data?.marks.map((mark) => (
          <MarkCard key={mark.id} mark={mark} />
        ))}
      </div>
      {!marks.data?.marks.length ? (
        <EmptyState label={t('marks.empty')} />
      ) : null}
    </Section>
  );
}

function MarkCard({ mark }: { mark: TulearnMarkSummary }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Trophy className="mb-4 h-6 w-6 text-dynamic-orange" />
      <p className="text-muted-foreground text-sm">{mark.metric.name}</p>
      <p className="font-bold text-3xl">
        {mark.value ?? '-'} {mark.metric.unit}
      </p>
      <p className="mt-2 text-muted-foreground text-xs">{mark.course?.name}</p>
    </div>
  );
}

export function SettingsPage() {
  const t = useTranslations();
  const { setTheme } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const bootstrap = useQuery({
    queryFn: () => getTulearnBootstrap(),
    queryKey: ['tulearn', 'bootstrap'],
  });
  const save = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, email: email || undefined }),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Unable to update profile');
    },
  });

  return (
    <Section title={t('settings.title')}>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">{t('settings.displayName')}</Label>
              <Input
                id="display-name"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={bootstrap.data?.profile.display_name ?? ''}
                value={displayName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('settings.email')}</Label>
              <Input
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={bootstrap.data?.profile.email ?? ''}
                type="email"
                value={email}
              />
            </div>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.theme')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => setTheme('light')} variant="secondary">
                <Sun className="h-4 w-4" />
                {t('settings.light')}
              </Button>
              <Button onClick={() => setTheme('dark')} variant="secondary">
                <Moon className="h-4 w-4" />
                {t('settings.dark')}
              </Button>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="font-medium">{t('settings.linkedStudents')}</p>
              <p className="text-muted-foreground text-sm">
                {bootstrap.data?.linkedStudents
                  .map((student) => student.name)
                  .join(', ') || t('common.empty')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="space-y-5">
      <h1 className="font-bold text-3xl tracking-normal">{title}</h1>
      {children}
    </section>
  );
}
