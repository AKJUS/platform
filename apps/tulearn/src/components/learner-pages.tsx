'use client';

import { useGSAP } from '@gsap/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Heart,
  LineChart,
  Lock,
  Moon,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  Trophy,
  Zap,
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
import { Input } from '@tuturuuu/ui/input';
import { Label } from '@tuturuuu/ui/label';
import { Progress } from '@tuturuuu/ui/progress';
import { cn } from '@tuturuuu/utils/format';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { type ReactNode, type RefObject, useRef, useState } from 'react';
import { Link } from '@/i18n/routing';

gsap.registerPlugin(useGSAP, ScrollTrigger);

type IconComponent = typeof Sparkles;

const courseThemes = [
  {
    border: 'border-dynamic-green/25',
    icon: BookOpen,
    surface: 'bg-dynamic-green/10',
    text: 'text-dynamic-green',
  },
  {
    border: 'border-dynamic-orange/25',
    icon: Flame,
    surface: 'bg-dynamic-orange/10',
    text: 'text-dynamic-orange',
  },
  {
    border: 'border-dynamic-blue/25',
    icon: LineChart,
    surface: 'bg-dynamic-blue/10',
    text: 'text-dynamic-blue',
  },
] as const;

function useStudentId() {
  return useSearchParams().get('studentId');
}

function useStudentHref(path: string) {
  const studentId = useStudentId();
  return studentId ? `${path}?studentId=${studentId}` : path;
}

function usePageMotion() {
  const scopeRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      if (reduceMotion) return;

      gsap.from('[data-tulearn-reveal]', {
        autoAlpha: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.07,
        y: 24,
      });

      gsap.to('[data-float-loop]', {
        duration: 2.8,
        ease: 'sine.inOut',
        repeat: -1,
        y: -8,
        yoyo: true,
      });

      const journey = scopeRef.current?.querySelector('[data-journey]');
      const pinTitle = scopeRef.current?.querySelector('[data-pin-title]');

      if (journey && pinTitle) {
        ScrollTrigger.create({
          end: 'bottom 70%',
          pin: pinTitle,
          pinSpacing: false,
          start: 'top 18%',
          trigger: journey,
        });
      }

      gsap.utils
        .toArray<HTMLElement>('[data-stack-card]')
        .forEach((card, index) => {
          gsap.to(card, {
            ease: 'none',
            scale: 1 - index * 0.018,
            scrollTrigger: {
              end: 'bottom 35%',
              scrub: true,
              start: 'top 75%',
              trigger: card,
            },
            y: -index * 12,
          });
        });
    },
    { scope: scopeRef }
  );

  return scopeRef;
}

function LoadingState() {
  const t = useTranslations();
  return (
    <div className="grid grid-flow-dense gap-3 md:grid-cols-6">
      <div className="h-64 animate-pulse rounded-[2rem] border border-border bg-card md:col-span-3 md:row-span-2" />
      <div className="h-32 animate-pulse rounded-[2rem] border border-border bg-card md:col-span-3" />
      <div className="h-32 animate-pulse rounded-[2rem] border border-border bg-card md:col-span-2" />
      <div className="h-32 animate-pulse rounded-[2rem] border border-border bg-card md:col-span-1" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

function EmptyState({ action, label }: { action?: ReactNode; label: string }) {
  return (
    <div className="rounded-[2rem] border border-dynamic-green/30 border-dashed bg-dynamic-green/10 p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-background text-dynamic-green shadow-sm">
        <Sparkles className="h-7 w-7" />
      </div>
      <p className="mx-auto max-w-md text-muted-foreground leading-7">
        {label}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function HomePage({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const studentId = useStudentId();
  const scopeRef = usePageMotion();
  const practiceHref = useStudentHref(`/${wsId}/practice`);
  const coursesHref = useStudentHref(`/${wsId}/courses`);
  const assignmentsHref = useStudentHref(`/${wsId}/assignments`);
  const home = useQuery({
    queryFn: () => getTulearnHome(wsId, studentId),
    queryKey: ['tulearn', wsId, studentId, 'home'],
  });

  if (home.isLoading) return <LoadingState />;
  if (!home.data) return <EmptyState label={t('common.empty')} />;

  const state = home.data.state;
  const nextCourse = home.data.courses[0];
  const dueAssignments = home.data.assignments.filter(
    (assignment) => !assignment.is_completed
  );
  const completedAssignments =
    home.data.assignments.length - dueAssignments.length;
  const averageProgress = home.data.courses.length
    ? Math.round(
        home.data.courses.reduce((sum, course) => sum + course.progress, 0) /
          home.data.courses.length
      )
    : 0;

  const quests = [
    {
      complete: Boolean(home.data.recommendedPractice),
      description: t('home.questPracticeDescription'),
      href: practiceHref,
      icon: Target,
      title: t('home.questPractice'),
    },
    {
      complete: dueAssignments.length === 0 && home.data.assignments.length > 0,
      description:
        dueAssignments.length > 0
          ? t('home.questAssignmentsCount', { count: dueAssignments.length })
          : t('assignments.empty'),
      href: assignmentsHref,
      icon: ClipboardCheck,
      title: t('home.questAssignments'),
    },
    {
      complete: averageProgress >= 80,
      description: t('home.questProgressDescription', {
        progress: averageProgress,
      }),
      href: coursesHref,
      icon: Star,
      title: t('home.questProgress'),
    },
  ];

  return (
    <div className="space-y-24" ref={scopeRef}>
      <section
        className="relative isolate overflow-hidden rounded-[2.25rem] border border-dynamic-green/20 bg-background p-6 shadow-sm md:p-9"
        data-tulearn-reveal
      >
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-dynamic-green/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-dynamic-orange/10 blur-3xl"
        />
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-end">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-dynamic-green/25 bg-dynamic-green/10 px-4 py-2 font-semibold text-dynamic-green text-sm">
              <Sparkles className="h-4 w-4" />
              {t('home.dailyGoal')}
            </div>
            <h1 className="max-w-5xl text-balance font-bold text-[clamp(2.8rem,6vw,5.75rem)] leading-[0.92] tracking-normal">
              {t('home.heroTitle', { name: home.data.student.name })}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-8">
              {home.data.recommendedPractice?.title ??
                t('home.heroDescription')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-dynamic-green px-6 font-semibold text-primary-foreground transition hover:bg-dynamic-green/90 active:translate-y-px"
                href={practiceHref}
              >
                <Zap className="h-4 w-4" />
                {t('home.startPractice')}
              </Link>
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-background px-6 font-semibold transition hover:bg-muted active:translate-y-px"
                href={coursesHref}
              >
                <BookOpen className="h-4 w-4" />
                {t('home.openMap')}
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatBubble
              icon={Sparkles}
              label={t('home.xp')}
              value={state.xp_total}
            />
            <StatBubble
              accent="orange"
              icon={Flame}
              label={t('home.streak')}
              value={state.current_streak}
            />
            <StatBubble
              accent="blue"
              icon={Heart}
              label={t('home.hearts')}
              value={`${state.hearts}/${state.max_hearts}`}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div
          className="grid grid-flow-dense gap-3 md:grid-cols-6"
          data-tulearn-reveal
        >
          <MissionPanel
            actionHref={nextCourse ? coursesHref : practiceHref}
            actionLabel={
              nextCourse ? t('home.continueCourse') : t('home.startPractice')
            }
            description={nextCourse?.description ?? t('courses.empty')}
            icon={Rocket}
            stat={`${averageProgress}%`}
            title={nextCourse?.name ?? t('home.nextLesson')}
          />
          <QuestPanel
            completedAssignments={completedAssignments}
            dueAssignments={dueAssignments.length}
            totalAssignments={home.data.assignments.length}
          />
          <MiniPanel
            icon={ShieldCheck}
            label={t('home.parentSnapshot')}
            span="wide"
            value={
              home.data.readOnly
                ? t('settings.parentMode')
                : t('home.studentMode')
            }
          />
          <MiniPanel
            icon={Trophy}
            label={t('home.recentWin')}
            span="compact"
            value={
              home.data.marks[0]?.metric.name ??
              home.data.recommendedPractice?.courseName ??
              t('common.empty')
            }
          />
        </div>
        <div className="space-y-3" data-tulearn-reveal>
          <h2 className="font-bold text-2xl tracking-normal">
            {t('home.dailyQuests')}
          </h2>
          {quests.map((quest) => (
            <QuestCard key={quest.title} quest={quest} />
          ))}
        </div>
      </section>

      <section
        className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)]"
        data-journey
      >
        <div className="h-fit" data-pin-title>
          <h2 className="font-bold text-[clamp(2rem,4vw,3.75rem)] leading-none tracking-normal">
            {t('home.learningPath')}
          </h2>
          <p className="mt-4 text-muted-foreground leading-7">
            {t('home.learningPathDescription')}
          </p>
        </div>
        <div className="space-y-4">
          {home.data.courses.slice(0, 5).map((course, index) => (
            <CourseCard course={course} index={index} key={course.id} stacked />
          ))}
          {!home.data.courses.length ? (
            <EmptyState label={t('courses.empty')} />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <FeatureList
          actionHref={assignmentsHref}
          actionLabel={t('assignments.title')}
          completedLabel={t('common.completed')}
          emptyLabel={t('assignments.empty')}
          items={home.data.assignments.slice(0, 4)}
          title={t('home.assignments')}
          type="assignment"
        />
        <FeatureList
          emptyLabel={t('marks.empty')}
          items={home.data.marks.slice(0, 4)}
          title={t('home.marks')}
          type="mark"
        />
      </section>
    </div>
  );
}

function StatBubble({
  accent = 'green',
  icon: Icon,
  label,
  value,
}: {
  accent?: 'blue' | 'green' | 'orange';
  icon: IconComponent;
  label: string;
  value: number | string;
}) {
  const styles = {
    blue: 'border-dynamic-blue/25 bg-dynamic-blue/10 text-dynamic-blue',
    green: 'border-dynamic-green/25 bg-dynamic-green/10 text-dynamic-green',
    orange: 'border-dynamic-orange/25 bg-dynamic-orange/10 text-dynamic-orange',
  };

  return (
    <div
      className={cn(
        'min-w-0 rounded-[1.5rem] border p-4 text-center shadow-sm',
        styles[accent]
      )}
      data-float-loop={accent === 'orange' ? '' : undefined}
    >
      <Icon className="mx-auto mb-2 h-5 w-5" />
      <p className="truncate font-bold text-2xl text-foreground">{value}</p>
      <p className="truncate text-xs">{label}</p>
    </div>
  );
}

function MissionPanel({
  actionHref,
  actionLabel,
  description,
  icon: Icon,
  stat,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  description: string | null;
  icon: IconComponent;
  stat: string;
  title: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-[2rem] border border-dynamic-green/25 bg-dynamic-green/10 p-6 md:col-span-3 md:row-span-2">
      <div className="flex h-full min-h-64 flex-col justify-between gap-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-background text-dynamic-green shadow-sm">
            <Icon className="h-7 w-7" />
          </div>
          <p className="rounded-full bg-background px-4 py-2 font-bold text-dynamic-green text-xl">
            {stat}
          </p>
        </div>
        <div>
          <h3 className="font-bold text-3xl tracking-normal">{title}</h3>
          <p className="mt-3 line-clamp-3 text-muted-foreground leading-7">
            {description}
          </p>
          <Link
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-dynamic-green px-5 font-semibold text-primary-foreground transition hover:bg-dynamic-green/90 active:translate-y-px"
            href={actionHref}
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function QuestPanel({
  completedAssignments,
  dueAssignments,
  totalAssignments,
}: {
  completedAssignments: number;
  dueAssignments: number;
  totalAssignments: number;
}) {
  const t = useTranslations();
  const progress = totalAssignments
    ? Math.round((completedAssignments / totalAssignments) * 100)
    : 0;

  return (
    <article className="rounded-[2rem] border border-dynamic-orange/25 bg-background p-6 md:col-span-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-2xl tracking-normal">
            {t('home.questBoard')}
          </h3>
          <p className="mt-2 text-muted-foreground text-sm">
            {t('home.questBoardDescription', { count: dueAssignments })}
          </p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-dynamic-orange/10 text-dynamic-orange">
          <Target className="h-7 w-7" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="flex justify-between font-semibold text-sm">
          <span>{t('common.completed')}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} />
      </div>
    </article>
  );
}

function MiniPanel({
  icon: Icon,
  label,
  span,
  value,
}: {
  icon: IconComponent;
  label: string;
  span: 'compact' | 'wide';
  value: string;
}) {
  return (
    <article
      className={cn(
        'rounded-[2rem] border border-border bg-card p-6',
        span === 'wide' ? 'md:col-span-2' : 'md:col-span-1'
      )}
    >
      <Icon className="mb-5 h-7 w-7 text-dynamic-blue" />
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-2 line-clamp-2 font-bold text-2xl tracking-normal">
        {value}
      </p>
    </article>
  );
}

function QuestCard({
  quest,
}: {
  quest: {
    complete: boolean;
    description: string;
    href: string;
    icon: IconComponent;
    title: string;
  };
}) {
  const Icon = quest.icon;
  return (
    <Link
      className="group flex items-center gap-3 rounded-[1.5rem] border border-border bg-card p-4 transition duration-200 hover:-translate-y-0.5 hover:border-dynamic-green/30 hover:bg-dynamic-green/10"
      href={quest.href}
    >
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
          quest.complete
            ? 'bg-dynamic-green text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {quest.complete ? (
          <CheckCircle2 className="h-6 w-6" />
        ) : (
          <Icon className="h-6 w-6" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{quest.title}</p>
        <p className="line-clamp-2 text-muted-foreground text-sm">
          {quest.description}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-dynamic-green" />
    </Link>
  );
}

export function CoursesPage({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const studentId = useStudentId();
  const scopeRef = usePageMotion();
  const courses = useQuery({
    queryFn: () => listTulearnCourses(wsId, studentId),
    queryKey: ['tulearn', wsId, studentId, 'courses'],
  });

  if (courses.isLoading) return <LoadingState />;

  return (
    <Section
      description={t('courses.mapDescription')}
      refValue={scopeRef}
      title={t('courses.title')}
    >
      <div className="space-y-4">
        {courses.data?.courses.map((course, index) => (
          <CourseCard course={course} index={index} key={course.id} />
        ))}
      </div>
      {!courses.data?.courses.length ? (
        <EmptyState label={t('courses.empty')} />
      ) : null}
    </Section>
  );
}

function CourseCard({
  course,
  index,
  stacked,
}: {
  course: TulearnCourseSummary;
  index: number;
  stacked?: boolean;
}) {
  const t = useTranslations();
  const theme = courseThemes[index % courseThemes.length] ?? courseThemes[0];
  const Icon = theme.icon;
  const nodes = Math.max(1, Math.min(course.totalModules || 1, 6));

  return (
    <article
      className={cn(
        'group rounded-[2rem] border bg-card p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md md:p-6',
        theme.border
      )}
      data-stack-card={stacked ? '' : undefined}
      data-tulearn-reveal
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center">
        <div>
          <div className="mb-5 flex items-center gap-3">
            <div
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-[1.25rem]',
                theme.surface,
                theme.text
              )}
            >
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <p className="font-bold text-2xl tracking-normal">
                {course.name}
              </p>
              <p className="text-muted-foreground text-sm">
                {t('courses.modules')}: {course.completedModules}/
                {course.totalModules}
              </p>
            </div>
          </div>
          <p className="line-clamp-2 max-w-2xl text-muted-foreground leading-7">
            {course.description ?? t('courses.empty')}
          </p>
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between font-semibold text-sm">
              <span>{t('home.learningPath')}</span>
              <span>{course.progress}%</span>
            </div>
            <Progress value={course.progress} />
          </div>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: nodes }).map((_, nodeIndex) => {
            const completed = nodeIndex < course.completedModules;
            const current = !completed && nodeIndex === course.completedModules;
            return (
              <div
                className={cn(
                  'flex aspect-square min-h-11 items-center justify-center rounded-2xl border transition duration-300 group-hover:scale-105',
                  completed &&
                    'border-dynamic-green/30 bg-dynamic-green text-primary-foreground',
                  current &&
                    'border-dynamic-orange/30 bg-dynamic-orange/10 text-dynamic-orange',
                  !completed &&
                    !current &&
                    'border-border bg-muted/50 text-muted-foreground'
                )}
                key={`${course.id}-${nodeIndex}`}
              >
                {completed ? (
                  <Check className="h-5 w-5" />
                ) : current ? (
                  <Star className="h-5 w-5" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

export function PracticePage({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const studentId = useStudentId();
  const queryClient = useQueryClient();
  const scopeRef = usePageMotion();
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

  const result = submit.data;

  return (
    <Section
      description={t('practice.description')}
      refValue={scopeRef}
      title={t('practice.title')}
    >
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div
          className="rounded-[2.25rem] border border-dynamic-green/25 bg-background p-6 shadow-sm md:p-8"
          data-tulearn-reveal
        >
          <Badge className="mb-5 bg-dynamic-blue/15 text-dynamic-blue hover:bg-dynamic-blue/15">
            {practice.data.item.courseName}
          </Badge>
          <h2 className="font-bold text-[clamp(2rem,4vw,4.25rem)] leading-none tracking-normal">
            {practice.data.item.title}
          </h2>
          <p className="mt-6 text-lg text-muted-foreground leading-8">
            {practice.data.item.prompt ?? t('practice.title')}
          </p>
          {result ? (
            <div
              className={cn(
                'mt-8 rounded-[1.75rem] border p-5',
                result.correct
                  ? 'border-dynamic-green/25 bg-dynamic-green/10'
                  : 'border-dynamic-orange/25 bg-dynamic-orange/10'
              )}
            >
              <p className="font-bold text-2xl tracking-normal">
                {result.correct
                  ? t('practice.correct')
                  : t('practice.incorrect')}
              </p>
              <p className="mt-2 text-muted-foreground">
                {t('practice.resultSummary', {
                  hearts: result.hearts,
                  xp: result.xpAwarded,
                })}
              </p>
            </div>
          ) : null}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Button
              className="h-12 rounded-full bg-dynamic-green text-primary-foreground hover:bg-dynamic-green/90"
              disabled={submit.isPending}
              onClick={() => submit.mutate(true)}
            >
              <Check className="h-4 w-4" />
              {t('practice.submitCorrect')}
            </Button>
            <Button
              className="h-12 rounded-full"
              disabled={submit.isPending}
              onClick={() => submit.mutate(false)}
              variant="secondary"
            >
              {t('practice.submitIncorrect')}
            </Button>
          </div>
        </div>
        <aside className="space-y-3" data-tulearn-reveal>
          <PracticeHint
            icon={Heart}
            label={t('home.hearts')}
            value={result ? String(result.hearts) : t('practice.keepHearts')}
          />
          <PracticeHint
            icon={Sparkles}
            label={t('home.xp')}
            value={
              result
                ? t('practice.xpAwardedValue', { xp: result.xpAwarded })
                : t('practice.xpHint')
            }
          />
          <PracticeHint
            icon={Zap}
            label={t('practice.again')}
            value={t('practice.retryHint')}
          />
        </aside>
      </div>
    </Section>
  );
}

function PracticeHint({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-border bg-card p-5">
      <Icon className="mb-4 h-6 w-6 text-dynamic-green" />
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 font-bold text-xl tracking-normal">{value}</p>
    </div>
  );
}

export function AssignmentsPage({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const studentId = useStudentId();
  const queryClient = useQueryClient();
  const scopeRef = usePageMotion();
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

  const rows = assignments.data?.assignments ?? [];
  const openRows = rows.filter((assignment) => !assignment.is_completed);

  return (
    <Section
      description={t('assignments.description', { count: openRows.length })}
      refValue={scopeRef}
      title={t('assignments.title')}
    >
      <div className="space-y-3">
        {rows.map((assignment) => (
          <AssignmentRow
            action={
              !assignment.is_completed ? (
                <Button
                  className="h-11 rounded-full bg-dynamic-green text-primary-foreground hover:bg-dynamic-green/90"
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
      {!rows.length ? <EmptyState label={t('assignments.empty')} /> : null}
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
    <div
      className="grid gap-4 rounded-[1.75rem] border border-border bg-card p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-dynamic-green/30 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
      data-tulearn-reveal
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-2xl',
              assignment.is_completed
                ? 'bg-dynamic-green text-primary-foreground'
                : 'bg-dynamic-orange/10 text-dynamic-orange'
            )}
          >
            {assignment.is_completed ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <ClipboardCheck className="h-5 w-5" />
            )}
          </div>
          <h3 className="font-bold text-xl tracking-normal">
            {assignment.title}
          </h3>
          {assignment.is_completed ? (
            <Badge className="bg-dynamic-green/15 text-dynamic-green hover:bg-dynamic-green/15">
              {completedLabel}
            </Badge>
          ) : null}
        </div>
        <p className="mt-2 text-muted-foreground text-sm">
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
  const scopeRef = usePageMotion();
  const reports = useQuery({
    queryFn: () => listTulearnReports(wsId, studentId),
    queryKey: ['tulearn', wsId, studentId, 'reports'],
  });

  if (reports.isLoading) return <LoadingState />;

  return (
    <Section
      description={t('reports.description')}
      refValue={scopeRef}
      title={t('reports.title')}
    >
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
    <article
      className="rounded-[2rem] border border-dynamic-blue/20 bg-card p-6 shadow-sm"
      data-tulearn-reveal
    >
      <LineChart className="mb-5 h-7 w-7 text-dynamic-blue" />
      <h3 className="font-bold text-2xl tracking-normal">{report.title}</h3>
      <p className="mt-3 line-clamp-5 text-muted-foreground leading-7">
        {report.feedback || report.content}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {report.course ? (
          <Badge className="bg-dynamic-blue/15 text-dynamic-blue hover:bg-dynamic-blue/15">
            {report.course.name}
          </Badge>
        ) : null}
        {report.score != null ? (
          <Badge className="bg-dynamic-green/15 text-dynamic-green hover:bg-dynamic-green/15">
            {report.score}
          </Badge>
        ) : null}
      </div>
    </article>
  );
}

export function MarksPage({ wsId }: { wsId: string }) {
  const t = useTranslations();
  const studentId = useStudentId();
  const scopeRef = usePageMotion();
  const marks = useQuery({
    queryFn: () => listTulearnMarks(wsId, studentId),
    queryKey: ['tulearn', wsId, studentId, 'marks'],
  });

  if (marks.isLoading) return <LoadingState />;

  return (
    <Section
      description={t('marks.description')}
      refValue={scopeRef}
      title={t('marks.title')}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {marks.data?.marks.map((mark, index) => (
          <MarkCard index={index} key={mark.id} mark={mark} />
        ))}
      </div>
      {!marks.data?.marks.length ? (
        <EmptyState label={t('marks.empty')} />
      ) : null}
    </Section>
  );
}

function MarkCard({
  index,
  mark,
}: {
  index: number;
  mark: TulearnMarkSummary;
}) {
  const theme = courseThemes[index % courseThemes.length] ?? courseThemes[0];
  return (
    <article
      className={cn(
        'rounded-[2rem] border bg-card p-6 shadow-sm transition duration-200 hover:-translate-y-0.5',
        theme.border
      )}
      data-tulearn-reveal
    >
      <Trophy className={cn('mb-5 h-7 w-7', theme.text)} />
      <p className="text-muted-foreground text-sm">{mark.metric.name}</p>
      <p className="mt-2 font-bold text-4xl tracking-normal">
        {mark.value ?? '-'}
        {mark.metric.unit ? (
          <span className="ml-1 text-base text-muted-foreground">
            {mark.metric.unit}
          </span>
        ) : null}
      </p>
      <p className="mt-4 text-muted-foreground text-sm">{mark.course?.name}</p>
    </article>
  );
}

export function SettingsPage() {
  const t = useTranslations();
  const { setTheme } = useTheme();
  const scopeRef = usePageMotion();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [focusMode, setFocusMode] = useState('balanced');
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
    <Section
      description={t('settings.description')}
      refValue={scopeRef}
      title={t('settings.title')}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div
          className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"
          data-tulearn-reveal
        >
          <h2 className="font-bold text-2xl tracking-normal">
            {t('settings.profile')}
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display-name">{t('settings.displayName')}</Label>
              <Input
                className="h-12 rounded-2xl"
                id="display-name"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={bootstrap.data?.profile.display_name ?? ''}
                value={displayName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('settings.email')}</Label>
              <Input
                className="h-12 rounded-2xl"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder={bootstrap.data?.profile.email ?? ''}
                type="email"
                value={email}
              />
            </div>
          </div>
          <Button
            className="mt-6 h-12 rounded-full bg-dynamic-green text-primary-foreground hover:bg-dynamic-green/90"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>

        <div className="space-y-5">
          <SettingsPanel icon={Sun} title={t('settings.theme')}>
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="h-12 rounded-2xl"
                onClick={() => setTheme('light')}
                variant="secondary"
              >
                <Sun className="h-4 w-4" />
                {t('settings.light')}
              </Button>
              <Button
                className="h-12 rounded-2xl"
                onClick={() => setTheme('dark')}
                variant="secondary"
              >
                <Moon className="h-4 w-4" />
                {t('settings.dark')}
              </Button>
            </div>
          </SettingsPanel>

          <SettingsPanel icon={Target} title={t('settings.focusMode')}>
            <div className="grid gap-2">
              {['light', 'balanced', 'challenge'].map((mode) => (
                <button
                  className={cn(
                    'min-h-11 rounded-2xl border px-4 py-3 text-left font-medium transition',
                    focusMode === mode
                      ? 'border-dynamic-green/30 bg-dynamic-green/10 text-dynamic-green'
                      : 'border-border bg-background hover:bg-muted'
                  )}
                  key={mode}
                  onClick={() => setFocusMode(mode)}
                  type="button"
                >
                  {t(`settings.focus.${mode}`)}
                </button>
              ))}
            </div>
          </SettingsPanel>
        </div>
      </div>

      <div
        className="rounded-[2rem] border border-dynamic-blue/20 bg-dynamic-blue/10 p-6"
        data-tulearn-reveal
      >
        <h2 className="font-bold text-2xl tracking-normal">
          {t('settings.linkedStudents')}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {bootstrap.data?.linkedStudents.length ? (
            bootstrap.data.linkedStudents.map((student) => (
              <span
                className="rounded-full border border-dynamic-blue/25 bg-background px-4 py-2 font-medium text-dynamic-blue text-sm"
                key={student.id}
              >
                {student.name}
              </span>
            ))
          ) : (
            <p className="text-muted-foreground">{t('common.empty')}</p>
          )}
        </div>
      </div>
    </Section>
  );
}

function SettingsPanel({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  icon: IconComponent;
  title: string;
}) {
  return (
    <div
      className="rounded-[2rem] border border-border bg-card p-5 shadow-sm"
      data-tulearn-reveal
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-dynamic-green/10 text-dynamic-green">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-bold text-xl tracking-normal">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FeatureList({
  actionHref,
  actionLabel,
  completedLabel,
  emptyLabel,
  items,
  title,
  type,
}: {
  actionHref?: string;
  actionLabel?: string;
  completedLabel?: string;
  emptyLabel: string;
  items: Array<TulearnAssignmentSummary | TulearnMarkSummary>;
  title: string;
  type: 'assignment' | 'mark';
}) {
  return (
    <section
      className="rounded-[2rem] border border-border bg-card p-6 shadow-sm"
      data-tulearn-reveal
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-bold text-2xl tracking-normal">{title}</h2>
        {actionHref && actionLabel ? (
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border px-4 font-semibold text-sm transition hover:bg-muted"
            href={actionHref}
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      <div className="space-y-3">
        {items.map((item) =>
          type === 'assignment' ? (
            <AssignmentRow
              assignment={item as TulearnAssignmentSummary}
              completedLabel={completedLabel ?? ''}
              key={item.id}
            />
          ) : (
            <MarkCard
              index={0}
              key={item.id}
              mark={item as TulearnMarkSummary}
            />
          )
        )}
      </div>
      {!items.length ? <EmptyState label={emptyLabel} /> : null}
    </section>
  );
}

function Section({
  children,
  description,
  refValue,
  title,
}: {
  children: ReactNode;
  description?: string;
  refValue?: RefObject<HTMLDivElement | null>;
  title: string;
}) {
  return (
    <div className="space-y-8" ref={refValue}>
      <section className="rounded-[2rem] border border-border bg-background p-6 shadow-sm md:p-8">
        <h1 className="max-w-5xl text-balance font-bold text-[clamp(2.5rem,5vw,4.75rem)] leading-none tracking-normal">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-muted-foreground leading-7">
            {description}
          </p>
        ) : null}
      </section>
      {children}
    </div>
  );
}
