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
    final firstDayOfWeek = _weekdayFromMaterialLocalizations(
      MaterialLocalizations.of(context).firstDayOfWeekIndex,
    );
    final period = _periodRange(viewMode, anchorDate, firstDayOfWeek);
    final periodLabel = switch (viewMode) {
      HistoryViewMode.day => DateFormat.yMMMEd().format(period.start),
      HistoryViewMode.week => () {
        final weekStartLabel = DateFormat.MMMd().format(period.start);
        final weekEndLabel = DateFormat.MMMd().format(period.end);
        return '$weekStartLabel – $weekEndLabel';
      }(),
      HistoryViewMode.month => DateFormat.yMMMM().format(period.start),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Top bar: segmented control (left) + jump-to-current (right) ──
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Pill-shaped segmented control
            Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: theme.colorScheme.secondary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _SegmentTab(
                    label: l10n.calendarDayView,
                    selected: viewMode == HistoryViewMode.day,
                    onTap: () => onViewModeChanged(HistoryViewMode.day),
                    theme: theme,
                  ),
                  _SegmentTab(
                    label: l10n.calendarWeekView,
                    selected: viewMode == HistoryViewMode.week,
                    onTap: () => onViewModeChanged(HistoryViewMode.week),
                    theme: theme,
                  ),
                  _SegmentTab(
                    label: l10n.calendarMonthView,
                    selected: viewMode == HistoryViewMode.month,
                    onTap: () => onViewModeChanged(HistoryViewMode.month),
                    theme: theme,
                  ),
                ],
              ),
            ),
            // Jump-to-current period
            shad.OutlineButton(
              onPressed: onGoToCurrent,
              child: Text(_goToCurrentLabel(l10n, viewMode)),
            ),
          ],
        ),
        const shad.Gap(8),
        // ── Period navigation: prev / date / next ─────────────────────────
        Row(
          children: [
            shad.IconButton.ghost(
              onPressed: onPrevious,
              icon: const Icon(Icons.chevron_left),
            ),
            Expanded(
              child: Text(
                periodLabel,
                style: theme.typography.small.copyWith(
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            shad.IconButton.ghost(
              onPressed: onNext,
              icon: const Icon(Icons.chevron_right),
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
    int firstDayOfWeek,
  ) {
    switch (mode) {
      case HistoryViewMode.day:
        final start = DateTime(anchor.year, anchor.month, anchor.day);
        return (start: start, end: start);
      case HistoryViewMode.week:
        final localAnchor = DateTime(
          anchor.year,
          anchor.month,
          anchor.day,
        );
        final offset = (localAnchor.weekday - firstDayOfWeek + 7) % 7;
        final start = localAnchor.subtract(Duration(days: offset));
        final end = start.add(const Duration(days: 6));
        return (start: start, end: end);
      case HistoryViewMode.month:
        final start = DateTime(anchor.year, anchor.month);
        final end = DateTime(anchor.year, anchor.month + 1, 0);
        return (start: start, end: end);
    }
  }

  int _weekdayFromMaterialLocalizations(int firstDayOfWeekIndex) {
    const weekdayByIndex = [
      DateTime.sunday,
      DateTime.monday,
      DateTime.tuesday,
      DateTime.wednesday,
      DateTime.thursday,
      DateTime.friday,
      DateTime.saturday,
    ];
    return weekdayByIndex[firstDayOfWeekIndex % 7];
  }
}

/// A single tab inside the pill-shaped segmented control.
class _SegmentTab extends StatelessWidget {
  const _SegmentTab({
    required this.label,
    required this.selected,
    required this.onTap,
    required this.theme,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final shad.ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Segment: $label',
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(7),
          focusColor: theme.colorScheme.primary.withValues(alpha: 0.18),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            curve: Curves.easeInOut,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: selected
                  ? theme.colorScheme.background
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(7),
              boxShadow: selected
                  ? [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ]
                  : null,
            ),
            child: Text(
              label,
              style: theme.typography.small.copyWith(
                fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                color: selected
                    ? theme.colorScheme.foreground
                    : theme.colorScheme.mutedForeground,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
