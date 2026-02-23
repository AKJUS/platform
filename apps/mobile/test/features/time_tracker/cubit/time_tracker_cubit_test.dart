import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/models/time_tracking/session.dart';
import 'package:mobile/data/repositories/time_tracker_repository.dart';
import 'package:mobile/features/time_tracker/cubit/time_tracker_cubit.dart';
import 'package:mocktail/mocktail.dart';

class _MockTimeTrackerRepository extends Mock
    implements ITimeTrackerRepository {}

class _TestTimeTrackerCubit extends TimeTrackerCubit {
  _TestTimeTrackerCubit({required super.repository});

  void setThresholdDays(int? thresholdDays) {
    emit(state.copyWith(thresholdDays: thresholdDays));
  }
}

void main() {
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
}
