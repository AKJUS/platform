import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile/features/time_tracker/cubit/time_tracker_state.dart';
import 'package:mobile/l10n/l10n.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart' as shad;

class HistoryPeriodControls extends StatelessWidget {
  const HistoryPeriodControls({
    required this.viewMode,
    required this.anchorDate,
    required this.onViewModeChanged,
    required this.onPrevious,
    required this.onNext,
    required this.onGoToCurrent,
    super.key,
  });

  final HistoryViewMode viewMode;
  final DateTime anchorDate;
  final ValueChanged<HistoryViewMode> onViewModeChanged;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onGoToCurrent;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = shad.Theme.of(context);
    final period = _periodRange(viewMode, anchorDate);
    final weekStartLabel = DateFormat.MMMd().format(period.start);
    final weekEndLabel = DateFormat.MMMd().format(period.end);
    final periodLabel = switch (viewMode) {
      HistoryViewMode.day => DateFormat.yMMMEd().format(period.start),
      HistoryViewMode.week => '$weekStartLabel - $weekEndLabel',
      HistoryViewMode.month => DateFormat.yMMMM().format(period.start),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            shad.Toggle(
              value: viewMode == HistoryViewMode.day,
              onChanged: (_) => onViewModeChanged(HistoryViewMode.day),
              child: Text(l10n.calendarDayView),
            ),
            const shad.Gap(4),
            shad.Toggle(
              value: viewMode == HistoryViewMode.week,
              onChanged: (_) => onViewModeChanged(HistoryViewMode.week),
              child: Text(l10n.calendarWeekView),
            ),
            const shad.Gap(4),
            shad.Toggle(
              value: viewMode == HistoryViewMode.month,
              onChanged: (_) => onViewModeChanged(HistoryViewMode.month),
              child: Text(l10n.calendarMonthView),
            ),
          ],
        ),
        const shad.Gap(8),
        Row(
          children: [
            shad.IconButton.ghost(
              onPressed: onPrevious,
              icon: const Icon(Icons.chevron_left),
            ),
            const shad.Gap(8),
            Expanded(
              child: Text(
                periodLabel,
                style: theme.typography.small.copyWith(
                  fontWeight: FontWeight.w600,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const shad.Gap(8),
            shad.IconButton.ghost(
              onPressed: onNext,
              icon: const Icon(Icons.chevron_right),
            ),
            const shad.Gap(8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: shad.OutlineButton(
                onPressed: onGoToCurrent,
                child: Text(_goToCurrentLabel(l10n, viewMode)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  String _goToCurrentLabel(AppLocalizations l10n, HistoryViewMode mode) {
    return switch (mode) {
      HistoryViewMode.day => l10n.timerToday,
      HistoryViewMode.week => l10n.timerThisWeek,
      HistoryViewMode.month => l10n.timerThisMonth,
    };
  }

  ({DateTime start, DateTime end}) _periodRange(
    HistoryViewMode mode,
    DateTime anchor,
  ) {
    switch (mode) {
      case HistoryViewMode.day:
        final start = DateTime(anchor.year, anchor.month, anchor.day);
        return (start: start, end: start);
      case HistoryViewMode.week:
        final start = DateTime(
          anchor.year,
          anchor.month,
          anchor.day,
        ).subtract(Duration(days: anchor.weekday - DateTime.monday));
        final end = start.add(const Duration(days: 6));
        return (start: start, end: end);
      case HistoryViewMode.month:
        final start = DateTime(anchor.year, anchor.month);
        final end = DateTime(anchor.year, anchor.month + 1, 0);
        return (start: start, end: end);
    }
  }
}
