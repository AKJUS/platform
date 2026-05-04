'use client';

import { useMutation } from '@tanstack/react-query';
import { BookOpen, KeyRound, Mail } from '@tuturuuu/icons';
import { Button } from '@tuturuuu/ui/button';
import { Input } from '@tuturuuu/ui/input';
import { Label } from '@tuturuuu/ui/label';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

async function postJson(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(data?.message || 'Request failed');
  }

  return response.json();
}

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const passwordLogin = useMutation({
    mutationFn: () => postJson('/api/auth/password-login', { email, password }),
    onError: (error) => setMessage(error.message),
    onSuccess: () => router.push(next),
  });

  const sendOtp = useMutation({
    mutationFn: () => postJson('/api/auth/send-otp', { email }),
    onError: (error) => setMessage(error.message),
    onSuccess: () => setMessage(t('auth.otpSent')),
  });

  const verifyOtp = useMutation({
    mutationFn: () => postJson('/api/auth/verify-otp', { email, otp }),
    onError: (error) => setMessage(error.message),
    onSuccess: () => router.push(next),
  });

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background md:grid-cols-[minmax(0,1fr)_440px]">
      <section className="flex min-h-[42vh] flex-col justify-between bg-linear-to-br from-dynamic-green/15 via-background to-dynamic-blue/10 p-8 md:min-h-screen md:p-12">
        <div className="flex items-center gap-3 font-semibold text-lg">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-dynamic-green text-white">
            <BookOpen className="h-5 w-5" />
          </span>
          Tulearn
        </div>
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex rounded-full border border-dynamic-green/30 bg-dynamic-green/10 px-3 py-1 font-medium text-dynamic-green text-sm">
            {t('home.dailyGoal')}
          </p>
          <h1 className="text-balance font-bold text-4xl tracking-normal md:text-6xl">
            {t('auth.title')}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            {t('auth.subtitle')}
          </p>
        </div>
        <div className="grid max-w-xl grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl border border-dynamic-green/20 bg-dynamic-green/10 p-4">
            <p className="font-semibold text-dynamic-green">+25 XP</p>
            <p className="text-muted-foreground">{t('practice.title')}</p>
          </div>
          <div className="rounded-2xl border border-dynamic-orange/20 bg-dynamic-orange/10 p-4">
            <p className="font-semibold text-dynamic-orange">5</p>
            <p className="text-muted-foreground">{t('home.hearts')}</p>
          </div>
          <div className="rounded-2xl border border-dynamic-blue/20 bg-dynamic-blue/10 p-4">
            <p className="font-semibold text-dynamic-blue">7</p>
            <p className="text-muted-foreground">{t('home.streak')}</p>
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5 rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
          <div>
            <h2 className="font-semibold text-2xl">{t('auth.login')}</h2>
            <p className="text-muted-foreground text-sm">
              {t('auth.subtitle')}
            </p>
          </div>
          <div className="space-y-3">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                className="pl-9"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </div>
          </div>
          <div className="space-y-3">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                className="pl-9"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>
          </div>
          <Button
            className="w-full bg-dynamic-green text-white hover:bg-dynamic-green/90"
            disabled={passwordLogin.isPending}
            onClick={() => passwordLogin.mutate()}
          >
            {t('auth.login')}
          </Button>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              aria-label={t('auth.otp')}
              onChange={(event) => setOtp(event.target.value)}
              placeholder={t('auth.otp')}
              value={otp}
            />
            <Button
              disabled={sendOtp.isPending || verifyOtp.isPending}
              onClick={() => (otp ? verifyOtp.mutate() : sendOtp.mutate())}
              type="button"
              variant="secondary"
            >
              {otp ? t('auth.submitCode') : t('auth.sendCode')}
            </Button>
          </div>
          {message ? (
            <p className="text-muted-foreground text-sm">{message}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
