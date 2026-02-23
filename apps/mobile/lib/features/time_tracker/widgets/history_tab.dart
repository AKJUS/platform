import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import 'package:mobile/core/responsive/adaptive_sheet.dart';
import 'package:mobile/data/models/time_tracking/session.dart';
import 'package:mobile/data/sources/supabase_client.dart';
import 'package:mobile/features/time_tracker/cubit/time_tracker_cubit.dart';
import 'package:mobile/features/time_tracker/cubit/time_tracker_state.dart';
import 'package:mobile/features/time_tracker/widgets/edit_session_dialog.dart';
import 'package:mobile/features/time_tracker/widgets/history_period_controls.dart';
import 'package:mobile/features/time_tracker/widgets/history_stats_accordion.dart';
import 'package:mobile/features/time_tracker/widgets/session_tile.dart';
import 'package:mobile/features/workspace/cubit/workspace_cubit.dart';
import 'package:mobile/l10n/l10n.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart' as shad;

class HistoryTab extends StatefulWidget {
  const HistoryTab({super.key});

  @override
  State<HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<HistoryTab> {
  late final ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController()..addListener(_handleScroll);
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_handleScroll)
      ..dispose();
    super.dispose();
  }

  void _handleScroll() {
    if (!_scrollController.hasClients) return;
    final threshold = _scrollController.position.maxScrollExtent - 220;
    if (_scrollController.position.pixels < threshold) return;

    final wsId =
        context.read<WorkspaceCubit>().state.currentWorkspace?.id ?? '';
    final userId = supabase.auth.currentUser?.id ?? '';
    unawaited(context.read<TimeTrackerCubit>().loadHistoryMore(wsId, userId));
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<TimeTrackerCubit, TimeTrackerState>(
      builder: (context, state) {
        final l10n = context.l10n;
        final sessions = state.historySessions;
        final theme = shad.Theme.of(context);
        final cubit = context.read<TimeTrackerCubit>();
        final wsId =
            context.read<WorkspaceCubit>().state.currentWorkspace?.id ?? '';
        final userId = supabase.auth.currentUser?.id ?? '';
        final anchorDate = state.historyAnchorDate ?? DateTime.now();
        final categoryColorById = {
          for (final category in state.categories) category.id: category.color,
        };

        if (state.isHistoryLoading && sessions.isEmpty) {
          return const Center(child: shad.CircularProgressIndicator());
        }

        final grouped = _groupByDay(sessions);

        return RefreshIndicator(
          onRefresh: () async {
            await cubit.refreshHistory(wsId, userId);
          },
          child: ListView(
            controller: _scrollController,
            padding: const EdgeInsets.only(bottom: 32),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: HistoryPeriodControls(
                  viewMode: state.historyViewMode,
                  anchorDate: anchorDate,
                  onViewModeChanged: (mode) {
                    unawaited(cubit.setHistoryViewMode(wsId, userId, mode));
                  },
                  onPrevious: () {
                    unawaited(cubit.goToPreviousPeriod(wsId, userId));
                  },
                  onNext: () {
                    unawaited(cubit.goToNextPeriod(wsId, userId));
                  },
                  onGoToCurrent: () {
                    unawaited(cubit.goToCurrentPeriod(wsId, userId));
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: HistoryStatsAccordion(
                  isOpen: state.isHistoryStatsAccordionOpen,
                  onToggle: () {
                    unawaited(cubit.toggleHistoryStatsAccordion());
                  },
                  stats: state.historyPeriodStats,
                  isLoading: state.isHistoryLoading,
                ),
              ),
              if (sessions.isEmpty && !state.isHistoryLoading)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
                  child: Column(
                    children: [
                      Icon(
                        Icons.history,
                        size: 40,
                        color: theme.colorScheme.mutedForeground,
                      ),
                      const shad.Gap(12),
                      Text(
                        l10n.timerHistoryNoSessionsForPeriod,
                        style: theme.typography.textMuted,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ...grouped.map(
                (entry) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
                      child: Text(
                        entry.label,
                        style: theme.typography.small.copyWith(
                          color: theme.colorScheme.mutedForeground,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    ...entry.sessions.map(
                      (session) => SessionTile(
                        session: session,
                        categoryColor: categoryColorById[session.categoryId],
                        onEdit: () => _showEditDialog(context, session),
                        onDelete: () => _deleteSession(context, session.id),
                      ),
                    ),
                  ],
                ),
              ),
              if (state.isHistoryLoadingMore)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(child: shad.CircularProgressIndicator()),
                ),
              if (state.historyHasMore && !state.isHistoryLoadingMore)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: shad.OutlineButton(
                    onPressed: () {
                      unawaited(cubit.loadHistoryMore(wsId, userId));
                    },
                    child: Text(l10n.timerHistoryLoadMore),
                  ),
                ),
              if (!state.historyHasMore && sessions.length > 10)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Text(
                    l10n.timerHistoryEndOfList,
                    style: theme.typography.small.copyWith(
                      color: theme.colorScheme.mutedForeground,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  List<_DayGroup> _groupByDay(List<TimeTrackingSession> sessions) {
    final dateFmt = DateFormat.yMMMEd();
    final groups = <String, List<TimeTrackingSession>>{};

    for (final session in sessions) {
      final date = session.startTime?.toLocal() ?? DateTime.now();
      final key = '${date.year}-${date.month}-${date.day}';
      groups.putIfAbsent(key, () => []).add(session);
    }

    return groups.entries.map((e) {
      final first = e.value.first;
      final date = first.startTime?.toLocal() ?? DateTime.now();
      return _DayGroup(
        label: dateFmt.format(date),
        sessions: e.value,
      );
    }).toList();
  }

  void _showEditDialog(BuildContext context, TimeTrackingSession session) {
    final cubit = context.read<TimeTrackerCubit>();
    final wsId =
        context.read<WorkspaceCubit>().state.currentWorkspace?.id ?? '';

    unawaited(
      showAdaptiveSheet<void>(
        context: context,
        builder: (_) => EditSessionDialog(
          session: session,
          categories: cubit.state.categories,
          onSave:
              ({
                title,
                description,
                categoryId,
                startTime,
                endTime,
              }) {
                unawaited(
                  cubit.editSession(
                    session.id,
                    wsId,
                    userId: supabase.auth.currentUser?.id,
                    title: title,
                    description: description,
                    categoryId: categoryId,
                    startTime: startTime,
                    endTime: endTime,
                  ),
                );
              },
        ),
      ),
    );
  }

  void _deleteSession(BuildContext context, String sessionId) {
    final cubit = context.read<TimeTrackerCubit>();
    final wsId =
        context.read<WorkspaceCubit>().state.currentWorkspace?.id ?? '';
    final userId = supabase.auth.currentUser?.id ?? '';
    unawaited(cubit.deleteSession(sessionId, wsId, userId));
  }
}

class _DayGroup {
  const _DayGroup({required this.label, required this.sessions});
  final String label;
  final List<TimeTrackingSession> sessions;
}
