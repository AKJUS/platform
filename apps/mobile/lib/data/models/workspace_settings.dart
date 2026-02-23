import 'package:equatable/equatable.dart';

class WorkspaceSettings extends Equatable {
  const WorkspaceSettings({this.missedEntryDateThreshold});

  factory WorkspaceSettings.fromJson(Map<String, dynamic> json) {
    final threshold = json['missed_entry_date_threshold'];
    return WorkspaceSettings(
      missedEntryDateThreshold: threshold is int ? threshold : null,
    );
  }

  final int? missedEntryDateThreshold;

  @override
  List<Object?> get props => [missedEntryDateThreshold];
}
