'use client';

import { DEV_MODE, PROD_MODE } from '@/constants/common';
import type { User } from '@tuturuuu/types/primitives/User';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

export interface NavLink {
  title: string;
  trailing?: string | ReactNode;
  icon?: ReactNode;
  href: string;
  newTab?: boolean;
  forceRefresh?: boolean;
  matchExact?: boolean;
  aliases?: string[];
  disabled?: boolean;
  showDisabled?: boolean;
  disableOnProduction?: boolean;
  requireRootMember?: boolean;
  allowedRoles?: string[];
  disabledRoles?: string[];
  pinned?: boolean;
  createdAt?: string;
}

interface Props {
  currentWsId?: string;
  currentRole?: string;
  currentUser?: User | null;
  navLinks: NavLink[];
}

export function Navigation({
  currentWsId,
  currentRole,
  currentUser,
  navLinks,
}: Props) {
  const pathname = usePathname();

  const scrollActiveLinksIntoView = () => {
    const activeWorkspaceLink = document.getElementById('active-ws-navlink');
    const activeLink = document.getElementById('active-navlink');

    if (activeWorkspaceLink) {
      activeWorkspaceLink.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }

    if (activeLink) {
      new Promise((resolve) => setTimeout(resolve, 500)).then(() =>
        activeLink.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        })
      );
    }
  };

  const [urlToLoad, setUrlToLoad] = useState<string>();

  useEffect(() => {
    if (urlToLoad) setUrlToLoad(undefined);
    scrollActiveLinksIntoView();
  }, [pathname]);

  return (
    <div className="mb-4 scrollbar-none flex flex-none gap-1 overflow-x-auto font-semibold">
      {navLinks.map((link) => {
        // If the link is disabled, don't render it
        if (link?.disabled) return null;

        // If the link is disabled on production, don't render it
        if (link?.disableOnProduction && PROD_MODE) return null;

        // If the link requires root membership, check if user email ends with @tuturuuu.com
        if (
          link?.requireRootMember &&
          !currentUser?.email?.endsWith('@tuturuuu.com')
        )
          return null;

        // If the link is only allowed for certain roles, check if the current role is allowed
        if (
          currentRole &&
          link?.allowedRoles &&
          link.allowedRoles.length > 0 &&
          (link?.allowedRoles?.includes(currentRole) === false ||
            link?.disabledRoles?.includes(currentRole) === true)
        )
          return null;

        const links = [...(link.aliases || []), link.href];
        const matchExact = link.matchExact ?? false;

        const isActive =
          links
            .map((href) =>
              matchExact
                ? pathname === href
                : (pathname?.startsWith(href) ?? false)
            )
            .filter(Boolean).length > 0;

        const isDevOnly = link.disableOnProduction;

        const enableUnderline = false;
        const notPublic = DEV_MODE && isDevOnly;

        return (
          <Link
            key={`${link.title}-${link.href}`}
            id={
              isActive && currentWsId
                ? 'active-ws-navlink'
                : isActive
                  ? 'active-navlink'
                  : undefined
            }
            className={`text-sm md:text-base ${
              isActive
                ? 'border-border bg-foreground/[0.025] text-foreground dark:bg-foreground/5'
                : urlToLoad === link.href
                  ? 'animate-pulse bg-foreground/5 text-foreground/70 dark:text-foreground/40'
                  : 'border-transparent text-foreground/70 md:hover:bg-foreground/5 md:hover:text-foreground dark:text-foreground/40'
            } ${
              enableUnderline && notPublic
                ? 'underline decoration-dashed underline-offset-4'
                : ''
            } flex-none rounded-lg border px-3 py-1 transition`}
            onClick={() => {
              setUrlToLoad(link.href);
              if (isActive) scrollActiveLinksIntoView();
            }}
            href={link.forceRefresh ? '/new' : link.href}
          >
            {link.title}
          </Link>
        );
      })}
    </div>
  );
}
