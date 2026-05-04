import { match } from '@formatjs/intl-localematcher';
import { resolveAuthenticatedSessionUser } from '@tuturuuu/supabase/next/auth-session-user';
import { createClient } from '@tuturuuu/supabase/next/server';
import { guardApiProxyRequest } from '@tuturuuu/utils/api-proxy-guard';
import Negotiator from 'negotiator';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { LOCALE_COOKIE_NAME } from './constants/common';
import {
  defaultLocale,
  type Locale,
  routing,
  supportedLocales,
} from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

function getPreferredLocale(request: NextRequest) {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale && supportedLocales.includes(cookieLocale as Locale)) {
    return cookieLocale;
  }

  const headers = Object.fromEntries(request.headers.entries());
  const languages = new Negotiator({ headers }).languages();
  return match(languages, supportedLocales, defaultLocale);
}

function stripLocale(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  const hasLocale =
    firstSegment && supportedLocales.includes(firstSegment as Locale);
  return `/${segments.slice(hasLocale ? 1 : 0).join('/')}`;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname.startsWith('/api')) {
    const guardResponse = await guardApiProxyRequest(request, {
      prefixBase: 'proxy:tulearn:api',
    });
    return guardResponse ?? NextResponse.next();
  }

  const unlocalizedPath = stripLocale(request.nextUrl.pathname);
  const isPublicPath = unlocalizedPath.startsWith('/login');

  if (!isPublicPath) {
    const supabase = await createClient(request);
    const { user } = await resolveAuthenticatedSessionUser(supabase);

    if (!user) {
      const locale = getPreferredLocale(request);
      const url = new URL(`/${locale}/login`, request.url);
      url.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
