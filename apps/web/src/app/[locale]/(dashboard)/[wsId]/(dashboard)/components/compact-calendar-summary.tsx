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
    <Card className="border-border/50">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-semibold text-sm">
            <Calendar className="h-4 w-4 text-dynamic-cyan" />
            {t('compact_calendar_title')}
          </CardTitle>
          <Link href={`/${wsId}/calendar`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              {t('view_all')}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {upcomingEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t('compact_calendar_empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2 rounded-md border border-border/30 p-2"
              >
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dynamic-cyan" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-xs">
                    {event.title || t('compact_calendar_untitled')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
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
