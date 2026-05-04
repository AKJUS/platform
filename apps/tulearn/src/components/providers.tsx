'use client';

import { NextIntlClientProvider, useMessages } from 'next-intl';
import type { ReactNode } from 'react';
import { ClientProviders } from './client-providers';

export function Providers({ children }: { children: ReactNode }) {
  const messages = useMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <ClientProviders>{children}</ClientProviders>
    </NextIntlClientProvider>
  );
}
