'use client';

import { cn } from '@tuturuuu/utils/format';
import { useState } from 'react';
import { useMiraSoul } from '../hooks/use-mira-soul';
import GreetingHeader from './greeting-header';
import MiraChatPanel from './mira-chat-panel';

interface MiraDashboardClientProps {
  currentUser: {
    id: string;
    display_name?: string | null;
    full_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  };
  initialAssistantName: string;
  wsId: string;
  children?: React.ReactNode; // Server-rendered insight widgets
}

function FullscreenGradientBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Blob 1 — top-left, purple-indigo */}
      <div
        className="absolute -top-32 -left-32 h-150 w-150 animate-[mira-blob_18s_ease-in-out_infinite] rounded-full opacity-[0.12] blur-[120px] dark:opacity-[0.07]"
        style={{
          background:
            'radial-gradient(circle, var(--color-dynamic-purple) 0%, var(--color-dynamic-indigo) 100%)',
        }}
      />
      {/* Blob 2 — bottom-right, cyan-blue */}
      <div
        className="absolute -right-40 -bottom-40 h-125 w-125 animate-[mira-blob_22s_ease-in-out_infinite_reverse] rounded-full opacity-[0.10] blur-[100px] dark:opacity-[0.06]"
        style={{
          background:
            'radial-gradient(circle, var(--color-dynamic-cyan) 0%, var(--color-dynamic-blue) 100%)',
        }}
      />
      {/* Blob 3 — center-right, pink-rose */}
      <div
        className="absolute top-1/3 right-1/4 h-100 w-100 animate-[mira-blob_15s_ease-in-out_2s_infinite] rounded-full opacity-[0.08] blur-[90px] dark:opacity-[0.05]"
        style={{
          background:
            'radial-gradient(circle, var(--color-dynamic-pink) 0%, var(--color-dynamic-rose) 100%)',
        }}
      />
    </div>
  );
}

export default function MiraDashboardClient({
  currentUser,
  initialAssistantName,
  wsId,
  children,
}: MiraDashboardClientProps) {
  const { data: soul } = useMiraSoul();
  const assistantName = soul?.name ?? initialAssistantName;
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div
      className={cn(
        'relative flex flex-col gap-4 overflow-hidden sm:gap-6',
        isFullscreen
          ? 'fixed inset-0 z-50 bg-background p-3 sm:p-4'
          : 'h-[calc(100vh-4rem)] min-h-0 xl:h-[calc(100vh-2rem)]'
      )}
    >
      {/* Animated gradient backdrop in fullscreen */}
      {isFullscreen && <FullscreenGradientBg />}

      {/* Greeting header — hidden in fullscreen */}
      {!isFullscreen && (
        <GreetingHeader
          currentUser={currentUser}
          assistantName={assistantName}
          wsId={wsId}
        />
      )}

      {/* Main layout: chat + insights */}
      <div
        className={cn(
          'relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6 xl:flex-row',
          !isFullscreen && 'xl:h-full'
        )}
      >
        {/* Chat panel — hero element; strict containment so content wraps inside on mobile */}
        <div
          className={cn(
            'flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-xl border p-3 pb-0 shadow-sm backdrop-blur-sm sm:p-4',
            isFullscreen
              ? 'border-border/30 bg-card/40'
              : 'border-border/60 bg-card/50'
          )}
        >
          <MiraChatPanel
            wsId={wsId}
            assistantName={assistantName}
            userAvatarUrl={currentUser.avatar_url}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
          />
        </div>

        {/* Insight sidebar — hidden in fullscreen; full width on mobile, constrained on xl+ */}
        {!isFullscreen && (
          <div className="w-full min-w-0 shrink-0 xl:max-w-xs 2xl:max-w-sm">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
