import { ArrowRight, Calendar, Clock } from '@tuturuuu/icons';
import { createClient } from '@tuturuuu/supabase/next/server';
import { Button } from '@tuturuuu/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@tuturuuu/ui/card';
import { isAllDayEvent } from '@tuturuuu/utils/calendar-utils';
import { format } from 'date-fns';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { decryptEventsFromStorage } from '@/lib/workspace-encryption';

interface CompactCalendarSummaryProps {
  wsId: string;
}

export default async function CompactCalendarSummary({
  wsId,
}: CompactCalendarSummaryProps) {
  const supabase = await createClient();
  const t = await getTranslations('dashboard');

  const now = new Date();
  const twoDaysFromNow = new Date();
  twoDaysFromNow.setDate(now.getDate() + 2);

  const { data: allEvents, error } = await supabase
    .from('workspace_calendar_events')
    .select('*')
    .eq('ws_id', wsId)
    .gte('start_at', now.toISOString())
    .lte('start_at', twoDaysFromNow.toISOString())
    .order('start_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error('Error fetching calendar summary:', error);
    return null;
  }

  const decryptedEvents = await decryptEventsFromStorage(allEvents || [], wsId);
  const viewableEvents = decryptedEvents.filter((e) => !e.is_encrypted);
  const upcomingEvents = viewableEvents
    .filter((event) => !isAllDayEvent(event))
    .slice(0, 3);

  return (
    <Card className="min-w-0 border-border/50">
      <CardHeader className="px-3 pt-3 pb-2 sm:px-4 sm:pt-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 truncate font-semibold text-sm">
            <Calendar className="h-4 w-4 shrink-0 text-dynamic-cyan" />
            <span className="truncate">{t('compact_calendar_title')}</span>
          </CardTitle>
          <Link href={`/${wsId}/calendar`} className="shrink-0">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              {t('view_all')}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
        {upcomingEvents.length === 0 ? (
          <p className="min-w-0 truncate text-muted-foreground text-sm">
            {t('compact_calendar_empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="flex min-w-0 items-start gap-2 rounded-md border border-border/30 p-2"
              >
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dynamic-cyan" />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate font-medium text-xs">
                    {event.title || t('compact_calendar_untitled')}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {format(new Date(event.start_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
