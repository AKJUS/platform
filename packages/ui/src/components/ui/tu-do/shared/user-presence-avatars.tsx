'use client';

import { User } from '@tuturuuu/icons';
import type { RealtimePresenceState } from '@tuturuuu/supabase/next/realtime';
import { Avatar, AvatarFallback, AvatarImage } from '@tuturuuu/ui/avatar';
import type { UserPresenceState } from '@tuturuuu/ui/hooks/usePresence';
import { usePresence } from '@tuturuuu/ui/hooks/usePresence';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@tuturuuu/ui/hover-card';
import { cn } from '@tuturuuu/utils/format';
import { getInitials } from '@tuturuuu/utils/name-helper';
import { useEffect } from 'react';
import { useTaskViewerContext } from '../providers/task-viewer-provider';

interface UserPresenceAvatarsProps {
  presenceState: RealtimePresenceState<UserPresenceState>;
  currentUserId?: string;
  maxDisplay?: number;
  avatarClassName?: string;
}

export function TaskViewerAvatarsComponent({
  taskId,
  isViewing,
}: {
  taskId: string;
  isViewing: boolean;
}) {
  const { getTaskViewers, currentUserId, viewTask, unviewTask } =
    useTaskViewerContext();

  useEffect(() => {
    if (isViewing) {
      viewTask(taskId);
    } else {
      unviewTask(taskId);
    }
  }, [taskId, isViewing, viewTask, unviewTask]);

  // Get viewers for the board (not per task)
  const presenceState = getTaskViewers(taskId);

  return (
    <UserPresenceAvatars
      presenceState={presenceState}
      currentUserId={currentUserId}
      maxDisplay={5}
      avatarClassName="size-4 sm:size-5"
    />
  );
}

export function UserPresenceAvatarsComponent({
  channelName,
}: {
  channelName: string;
}) {
  const { presenceState, currentUserId } = usePresence(channelName);

  return (
    <UserPresenceAvatars
      presenceState={presenceState}
      currentUserId={currentUserId}
      maxDisplay={5}
    />
  );
}

export function UserPresenceAvatars({
  presenceState,
  currentUserId,
  maxDisplay = 5,
  avatarClassName,
}: UserPresenceAvatarsProps) {
  const uniqueUsers = Object.entries(presenceState)
    .map(([, presences]) => presences[0]?.user)
    .filter(Boolean);

  // Sort users to place current user first
  const sortedUsers = [...uniqueUsers].sort((a, b) => {
    const aIsCurrentUser = a?.id === currentUserId;
    const bIsCurrentUser = b?.id === currentUserId;

    if (aIsCurrentUser && !bIsCurrentUser) return -1;
    if (!aIsCurrentUser && bIsCurrentUser) return 1;
    return 0;
  });

  const displayUsers = sortedUsers.slice(0, maxDisplay);
  const remainingCount = Math.max(0, sortedUsers.length - maxDisplay);

  // Don't render anything if no users online
  if (uniqueUsers.length === 0) return null;

  return (
    <div className="-space-x-2 flex items-center">
      {/* Avatar stack with overlap */}
      {displayUsers.map((user) => {
        if (!user || !user.id) return null;
        const isCurrentUser = user.id === currentUserId;
        const presences = presenceState[user.id] || [];
        const presenceCount = presences.length;

        return (
          <HoverCard key={user.id}>
            <HoverCardTrigger asChild>
              <div className="relative transition-transform hover:z-10 hover:scale-110">
                <Avatar
                  className={cn(
                    'size-7 border-2 border-background ring-1 ring-border transition-shadow hover:ring-2 sm:size-8',
                    isCurrentUser &&
                      'ring-dynamic-blue/60 hover:ring-dynamic-blue',
                    avatarClassName
                  )}
                >
                  {user.avatar_url ? (
                    <AvatarImage
                      src={user.avatar_url}
                      alt={user.display_name || user.email || 'User'}
                    />
                  ) : null}
                  <AvatarFallback className="font-semibold text-[10px] text-foreground sm:text-xs">
                    {user.display_name || user.email ? (
                      getInitials(user.display_name || user.email)
                    ) : (
                      <User className="h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                {presenceCount > 1 && (
                  <div className="-right-1 -top-1 absolute flex h-3.5 w-3.5 items-center justify-center rounded-full border border-background bg-dynamic-blue font-bold text-[9px] text-white sm:h-4 sm:w-4 sm:text-[10px]">
                    {presenceCount}
                  </div>
                )}
              </div>
            </HoverCardTrigger>
            <HoverCardContent side="bottom" className="w-80">
              <div className="flex gap-3">
                <Avatar className="size-10">
                  {user.avatar_url ? (
                    <AvatarImage
                      src={user.avatar_url}
                      alt={user.display_name || user.email || 'User'}
                    />
                  ) : null}
                  <AvatarFallback className="font-semibold text-foreground text-sm">
                    {user.display_name || user.email ? (
                      getInitials(user.display_name || user.email)
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-sm">
                    {user.display_name || 'Unknown User'}
                    {isCurrentUser && ' (You)'}
                  </p>
                  {user.email && (
                    <p className="text-muted-foreground text-xs">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 border-t pt-2">
                <p className="text-muted-foreground text-xs">
                  Active sessions: {presenceCount}
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}

      {/* Overflow indicator */}
      {remainingCount > 0 && (
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="relative transition-transform hover:z-10 hover:scale-110">
              <Avatar className="size-7 border-2 border-background ring-1 ring-border transition-shadow hover:ring-2 sm:size-8">
                <AvatarFallback className="bg-muted font-semibold text-[10px] text-muted-foreground sm:text-xs">
                  +{remainingCount}
                </AvatarFallback>
              </Avatar>
            </div>
          </HoverCardTrigger>
          <HoverCardContent side="bottom">
            <p className="text-sm">{remainingCount} more online</p>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
}
