import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/models/time_tracking/period_stats.dart';
import 'package:mobile/data/models/time_tracking/session.dart';
import 'package:mobile/data/models/time_tracking/session_page.dart';
import 'package:mobile/data/repositories/time_tracker_repository.dart';
import 'package:mobile/features/time_tracker/cubit/time_tracker_cubit.dart';
import 'package:mobile/features/time_tracker/cubit/time_tracker_state.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockTimeTrackerRepository extends Mock
    implements ITimeTrackerRepository {}

class _TestTimeTrackerCubit extends TimeTrackerCubit {
  _TestTimeTrackerCubit({required super.repository});

  void setThresholdDays(int? thresholdDays) {
    emit(state.copyWith(thresholdDays: thresholdDays));
  }
}

void main() {
  setUpAll(() {
    registerFallbackValue(DateTime(2000));
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('TimeTrackerCubit.sessionExceedsThreshold', () {
    late _MockTimeTrackerRepository repository;
    late _TestTimeTrackerCubit cubit;

    setUp(() {
      repository = _MockTimeTrackerRepository();
      cubit = _TestTimeTrackerCubit(repository: repository);
    });

    tearDown(() async {
      await cubit.close();
    });

    test('returns false when threshold is null', () {
      cubit.setThresholdDays(null);
      final session = TimeTrackingSession(
        id: 'session-1',
        startTime: DateTime.now().subtract(const Duration(days: 10)),
      );

      expect(cubit.sessionExceedsThreshold(session), isFalse);
    });

    test('returns true when threshold is zero', () {
      cubit.setThresholdDays(0);
      final session = TimeTrackingSession(
        id: 'session-2',
        startTime: DateTime.now().subtract(const Duration(minutes: 5)),
      );

      expect(cubit.sessionExceedsThreshold(session), isTrue);
    });

    test('returns true when session is older than threshold', () {
      cubit.setThresholdDays(2);
      final session = TimeTrackingSession(
        id: 'session-3',
        startTime: DateTime.now().subtract(const Duration(days: 3)),
      );

      expect(cubit.sessionExceedsThreshold(session), isTrue);
    });

    test('returns false when session is within threshold', () {
      cubit.setThresholdDays(3);
      final session = TimeTrackingSession(
        id: 'session-4',
        startTime: DateTime.now().subtract(const Duration(days: 1)),
      );

      expect(cubit.sessionExceedsThreshold(session), isFalse);
    });
  });

  group('TimeTrackerCubit history behavior', () {
    late _MockTimeTrackerRepository repository;
    late TimeTrackerCubit cubit;

    setUp(() {
      repository = _MockTimeTrackerRepository();
      cubit = TimeTrackerCubit(repository: repository);
    });

    tearDown(() async {
      await cubit.close();
    });

    test('changes view mode and loads initial history', () async {
      when(
        () => repository.getHistorySessions(
          any(),
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          cursor: any(named: 'cursor'),
          limit: any(named: 'limit'),
          userId: any(named: 'userId'),
        ),
      ).thenAnswer(
        (_) async => const TimeTrackingSessionPage(
          sessions: [],
          hasMore: false,
        ),
      );
      when(
        () => repository.getPeriodStats(
          any(),
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          userId: any(named: 'userId'),
        ),
      ).thenAnswer(
        (_) async => const TimeTrackingPeriodStats(
          totalDuration: 1200,
          sessionCount: 2,
        ),
      );

      expect(cubit.state.historyViewMode, isNot(HistoryViewMode.month));
      await cubit.setHistoryViewMode('ws-1', 'user-1', HistoryViewMode.month);

      expect(cubit.state.historyViewMode, HistoryViewMode.month);
      expect(cubit.state.historyPeriodStats?.sessionCount, 2);
      verify(
        () => repository.getHistorySessions(
          'ws-1',
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          cursor: any(named: 'cursor'),
          limit: any(named: 'limit'),
          userId: 'user-1',
        ),
      ).called(1);
    });

    test('loadHistoryMore appends next page results', () async {
      when(
        () => repository.getHistorySessions(
          any(),
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          cursor: any(named: 'cursor'),
          limit: any(named: 'limit'),
          userId: any(named: 'userId'),
        ),
      ).thenAnswer((invocation) async {
        final cursor = invocation.namedArguments[#cursor] as String?;
        if (cursor == null) {
          return const TimeTrackingSessionPage(
            sessions: [TimeTrackingSession(id: 's1')],
            hasMore: true,
            nextCursor: 'next-1',
          );
        }
        return const TimeTrackingSessionPage(
          sessions: [TimeTrackingSession(id: 's2')],
          hasMore: false,
        );
      });
      when(
        () => repository.getPeriodStats(
          any(),
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          userId: any(named: 'userId'),
        ),
      ).thenAnswer((_) async => const TimeTrackingPeriodStats());

      await cubit.loadHistoryInitial('ws-1', 'user-1');
      await cubit.loadHistoryMore('ws-1', 'user-1');

      expect(cubit.state.historySessions.map((e) => e.id), ['s1', 's2']);
      expect(cubit.state.historyHasMore, isFalse);
    });

    test('toggleHistoryStatsAccordion persists preference', () async {
      expect(cubit.state.isHistoryStatsAccordionOpen, isFalse);
      await cubit.toggleHistoryStatsAccordion();
      expect(cubit.state.isHistoryStatsAccordionOpen, isTrue);

      final prefs = await SharedPreferences.getInstance();
      expect(
        prefs.getBool('time_tracker_history_stats_open'),
        isTrue,
      );
    });
  });
}
