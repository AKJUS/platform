'use client';

import { useQuery } from '@tanstack/react-query';
import { QrCode, RefreshCw, Smartphone } from '@tuturuuu/icons';
import {
  createQrLoginChallengeWithInternalApi,
  pollQrLoginChallengeWithInternalApi,
  type QrLoginSessionPayload,
} from '@tuturuuu/internal-api/auth';
import { Button } from '@tuturuuu/ui/button';
import { LoadingIndicator } from '@tuturuuu/ui/custom/loading-indicator';
import { useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface LoginQrCardProps {
  captchaToken?: string;
  captchaTokenVersion?: number;
  disabled?: boolean;
  locale: string;
  onAuthenticated: (session: QrLoginSessionPayload) => Promise<void>;
  requiresTurnstile?: boolean;
}

function readSecretFromPayload(payload?: string) {
  if (!payload) {
    return null;
  }

  try {
    return new URL(payload).searchParams.get('secret');
  } catch {
    return null;
  }
}

export function LoginQrCard({
  captchaToken,
  captchaTokenVersion = 0,
  disabled = false,
  locale,
  onAuthenticated,
  requiresTurnstile = false,
}: LoginQrCardProps) {
  const t = useTranslations();
  const [refreshIndex, setRefreshIndex] = useState(0);
  const handledSessionRef = useRef(false);
  const canCreateChallenge = !requiresTurnstile || Boolean(captchaToken);

  const challengeQuery = useQuery({
    enabled: canCreateChallenge && !disabled,
    queryFn: () => {
      const payload = {
        captchaToken,
        locale,
        origin: window.location.origin,
      };

      return createQrLoginChallengeWithInternalApi(payload);
    },
    queryKey: [
      'auth',
      'qr-login',
      'challenge',
      locale,
      captchaTokenVersion,
      refreshIndex,
    ],
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const challenge = canCreateChallenge ? challengeQuery.data?.challenge : null;
  const secret = useMemo(
    () => readSecretFromPayload(challenge?.payload),
    [challenge?.payload]
  );

  const pollQuery = useQuery({
    enabled:
      Boolean(challenge?.id && secret) &&
      !handledSessionRef.current &&
      !disabled,
    queryFn: () =>
      pollQrLoginChallengeWithInternalApi({
        challengeId: challenge?.id || '',
        secret: secret || '',
      }),
    queryKey: ['auth', 'qr-login', 'poll', challenge?.id, secret],
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === 'pending') {
        return 2000;
      }
      return false;
    },
    refetchOnWindowFocus: true,
    retry: false,
  });

  const session = pollQuery.data?.session;

  useEffect(() => {
    if (!session || handledSessionRef.current) {
      return;
    }

    handledSessionRef.current = true;
    void onAuthenticated(session);
  }, [onAuthenticated, session]);

  const refreshChallenge = useCallback(() => {
    handledSessionRef.current = false;
    setRefreshIndex((value) => value + 1);
  }, []);

  const status = pollQuery.data?.status ?? challenge?.status;
  const isExpired = status === 'expired' || status === 'consumed';
  const isApproving = status === 'approved' && !session;
  const isLoading = challengeQuery.isLoading || challengeQuery.isFetching;
  const hasError =
    challengeQuery.isError ||
    pollQuery.isError ||
    challengeQuery.data?.error ||
    pollQuery.data?.error;

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <QrCode className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-sm">{t('login.qr_title')}</p>
          <p className="text-muted-foreground text-xs leading-5">
            {t('login.qr_description')}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        <div className="flex size-48 items-center justify-center rounded-2xl border border-border/60 bg-background p-3">
          {!canCreateChallenge ? (
            <div className="space-y-2 text-center">
              <p className="font-medium text-sm">
                {t('login.qr_turnstile_title')}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('login.qr_turnstile_description')}
              </p>
            </div>
          ) : isLoading ? (
            <LoadingIndicator className="size-6" />
          ) : hasError || !challenge?.payload || !secret ? (
            <div className="space-y-2 text-center">
              <p className="font-medium text-destructive text-sm">
                {t('login.qr_unavailable_title')}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('login.qr_unavailable_description')}
              </p>
            </div>
          ) : isExpired ? (
            <div className="space-y-2 text-center">
              <p className="font-medium text-sm">{t('login.qr_expired')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={refreshChallenge}
                disabled={disabled}
              >
                <RefreshCw className="size-4" />
                <span>{t('login.qr_refresh')}</span>
              </Button>
            </div>
          ) : (
            <QRCodeSVG
              value={challenge.payload}
              size={168}
              level="M"
              marginSize={1}
            />
          )}
        </div>

        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {isApproving || session ? (
            <>
              <LoadingIndicator className="size-3.5" />
              <span>{t('login.qr_approving')}</span>
            </>
          ) : (
            <>
              <Smartphone className="size-3.5" />
              <span>{t('login.qr_scan_hint')}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
