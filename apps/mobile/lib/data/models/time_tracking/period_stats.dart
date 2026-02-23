import 'package:equatable/equatable.dart';

class TimeTrackingPeriodBreakdown extends Equatable {
  const TimeTrackingPeriodBreakdown({
    required this.name,
    required this.duration,
    required this.color,
  });

  factory TimeTrackingPeriodBreakdown.fromJson(Map<String, dynamic> json) =>
      TimeTrackingPeriodBreakdown(
        name: json['name'] as String? ?? '',
        duration: (json['duration'] as num?)?.toInt() ?? 0,
        color: json['color'] as String? ?? 'blue',
      );

  final String name;
  final int duration;
  final String color;

  @override
  List<Object?> get props => [name, duration, color];
}

class TimeTrackingPeriodStats extends Equatable {
  const TimeTrackingPeriodStats({
    this.totalDuration = 0,
    this.sessionCount = 0,
    this.breakdown = const [],
  });

  factory TimeTrackingPeriodStats.fromJson(Map<String, dynamic> json) {
    final rawBreakdown = json['breakdown'] as List<dynamic>? ?? [];
    return TimeTrackingPeriodStats(
      totalDuration: (json['totalDuration'] as num?)?.toInt() ?? 0,
      sessionCount: (json['sessionCount'] as num?)?.toInt() ?? 0,
      breakdown: rawBreakdown
          .map(
            (entry) => TimeTrackingPeriodBreakdown.fromJson(
              entry as Map<String, dynamic>,
            ),
          )
          .toList(),
    );
  }

  final int totalDuration;
  final int sessionCount;
  final List<TimeTrackingPeriodBreakdown> breakdown;

  @override
  List<Object?> get props => [totalDuration, sessionCount, breakdown];
}
