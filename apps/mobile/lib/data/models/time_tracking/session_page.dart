import 'package:equatable/equatable.dart';
import 'package:mobile/data/models/time_tracking/session.dart';

class TimeTrackingSessionPage extends Equatable {
  const TimeTrackingSessionPage({
    required this.sessions,
    required this.hasMore,
    this.nextCursor,
  });

  factory TimeTrackingSessionPage.fromJson(Map<String, dynamic> json) {
    final rawSessions = json['sessions'] as List<dynamic>? ?? [];
    return TimeTrackingSessionPage(
      sessions: rawSessions
          .map(
            (entry) =>
                TimeTrackingSession.fromJson(entry as Map<String, dynamic>),
          )
          .toList(),
      hasMore: json['hasMore'] as bool? ?? false,
      nextCursor: json['nextCursor'] as String?,
    );
  }

  final List<TimeTrackingSession> sessions;
  final bool hasMore;
  final String? nextCursor;

  @override
  List<Object?> get props => [sessions, hasMore, nextCursor];
}
