import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/models/time_tracking/category.dart';
import 'package:mobile/features/time_tracker/widgets/missed_entry_dialog.dart';
import 'package:mobile/l10n/l10n.dart';

import '../../../helpers/pump_app.dart';

void main() {
  final oldStartTime = DateTime.now().subtract(const Duration(days: 2));
  final oldEndTime = oldStartTime.add(const Duration(hours: 1));

  group('MissedEntryDialog', () {
    testWidgets('requires proof for old entries without bypass permission', (
      tester,
    ) async {
      await tester.pumpApp(
        MissedEntryDialog(
          categories: const <TimeTrackingCategory>[],
          thresholdDays: 1,
          initialStartTime: oldStartTime,
          initialEndTime: oldEndTime,
          onSave:
              ({
                required title,
                required startTime,
                required endTime,
                required shouldSubmitAsRequest,
                required imageLocalPaths,
                categoryId,
                description,
              }) async {},
        ),
      );

      final l10n = tester.element(find.byType(MissedEntryDialog)).l10n;

      expect(find.text(l10n.timerProofOfWorkRequired), findsOneWidget);
      expect(find.text(l10n.timerSubmitForApproval), findsOneWidget);
      expect(find.text(l10n.timerSave), findsNothing);
    });

    testWidgets('submits as regular entry with bypass permission', (
      tester,
    ) async {
      await tester.pumpApp(
        MissedEntryDialog(
          categories: const <TimeTrackingCategory>[],
          canBypassRequestApproval: true,
          thresholdDays: 1,
          initialStartTime: oldStartTime,
          initialEndTime: oldEndTime,
          onSave:
              ({
                required title,
                required startTime,
                required endTime,
                required shouldSubmitAsRequest,
                required imageLocalPaths,
                categoryId,
                description,
              }) async {},
        ),
      );

      final l10n = tester.element(find.byType(MissedEntryDialog)).l10n;

      expect(find.text(l10n.timerProofOfWorkRequired), findsNothing);
      expect(find.text(l10n.timerSubmitForApproval), findsNothing);
      expect(find.text(l10n.timerSave), findsOneWidget);
    });
  });
}
