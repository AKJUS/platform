'use client';

import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  HeartPulse,
  Home,
  LineChart,
  Settings,
} from '@tuturuuu/icons';
import type {
  TulearnBootstrapResponse,
  TulearnStudentSummary,
  TulearnWorkspaceSummary,
} from '@tuturuuu/internal-api';
import { Button } from '@tuturuuu/ui/button';
import { cn } from '@tuturuuu/utils/format';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/routing';

const navItems = [
  { key: 'home', href: '', icon: Home },
  { key: 'practice', href: '/practice', icon: HeartPulse },
  { key: 'courses', href: '/courses', icon: BookOpen },
  { key: 'assignments', href: '/assignments', icon: ClipboardCheck },
  { key: 'reports', href: '/reports', icon: LineChart },
  { key: 'marks', href: '/marks', icon: BarChart3 },
  { key: 'settings', href: '/settings', icon: Settings },
] as const;

export function LearnerShell({
  bootstrap,
  children,
  selectedStudentId,
  wsId,
}: {
  bootstrap: TulearnBootstrapResponse;
  children: ReactNode;
  selectedStudentId?: string | null;
  wsId: string;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const linkedStudents = bootstrap.linkedStudents.filter(
    (student) => student.workspace_id === wsId
  );
  const activeWorkspace =
    bootstrap.workspaces.find((workspace) => workspace.id === wsId) ??
    bootstrap.workspaces[0];

  const makeHref = (itemHref: string) => {
    const query = selectedStudentId ? `?studentId=${selectedStudentId}` : '';
    return `/${wsId}${itemHref}${query}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-x-0 bottom-0 z-20 border-border border-t bg-background/95 backdrop-blur md:inset-y-0 md:right-auto md:left-0 md:w-24 md:border-t-0 md:border-r">
        <div className="hidden h-20 items-center justify-center md:flex">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-dynamic-green text-white">
            <GraduationCap className="h-6 w-6" />
          </div>
        </div>
        <nav className="grid grid-cols-7 gap-1 p-2 md:grid-cols-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const href = makeHref(item.href);
            const isActive =
              item.href === ''
                ? pathname === `/${wsId}`
                : pathname.startsWith(`/${wsId}${item.href}`);

            return (
              <Link
                aria-label={t(`navigation.${item.key}`)}
                className={cn(
                  'flex h-14 items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-dynamic-green/10 hover:text-dynamic-green',
                  isActive && 'bg-dynamic-green/15 text-dynamic-green'
                )}
                href={href}
                key={item.key}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-h-screen pb-24 md:pb-0 md:pl-24">
        <header className="sticky top-0 z-10 border-border border-b bg-background/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-xl">Tulearn</p>
              <p className="text-muted-foreground text-sm">
                {activeWorkspace?.name ?? t('workspace.empty')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label={t('workspace.switcher')}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                onChange={(event) => router.push(`/${event.target.value}`)}
                value={wsId}
              >
                {bootstrap.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              {linkedStudents.length ? (
                <select
                  aria-label={t('settings.linkedStudents')}
                  className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  onChange={(event) => {
                    const studentId = event.target.value;
                    router.push(
                      studentId ? `/${wsId}?studentId=${studentId}` : `/${wsId}`
                    );
                  }}
                  value={selectedStudentId ?? ''}
                >
                  <option value="">{bootstrap.profile.display_name}</option>
                  {linkedStudents.map((student: TulearnStudentSummary) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <form action="/api/auth/logout" method="post">
                <Button size="sm" type="submit" variant="secondary">
                  {t('auth.logout')}
                </Button>
              </form>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}

export function NoWorkspaceState() {
  const t = useTranslations();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-3xl border border-dynamic-orange/25 bg-dynamic-orange/10 p-8 text-center">
        <GraduationCap className="mx-auto mb-4 h-10 w-10 text-dynamic-orange" />
        <h1 className="font-semibold text-2xl">{t('workspace.empty')}</h1>
        <p className="mt-3 text-muted-foreground">{t('auth.subtitle')}</p>
      </div>
    </div>
  );
}

export type { TulearnWorkspaceSummary };
