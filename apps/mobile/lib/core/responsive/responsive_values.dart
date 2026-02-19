import 'package:flutter/widgets.dart';
import 'package:mobile/core/responsive/breakpoints.dart';

/// Picks a value based on the current device class derived from screen width.
///
/// [medium] and [expanded] fall back to the next-smaller tier when omitted.
T responsiveValue<T>(
  BuildContext context, {
  required T compact,
  T? medium,
  T? expanded,
}) {
  final deviceClass = context.deviceClass;
  return switch (deviceClass) {
    DeviceClass.expanded => expanded ?? medium ?? compact,
    DeviceClass.medium => medium ?? compact,
    DeviceClass.compact => compact,
  };
}

/// Convenience extensions on [BuildContext] for responsive queries.
extension ResponsiveContext on BuildContext {
  /// The current [DeviceClass] based on screen width.
  DeviceClass get deviceClass =>
      Breakpoints.fromWidth(MediaQuery.sizeOf(this).width);

  /// `true` when the screen width is in the compact range (< 600dp).
  bool get isCompact => deviceClass == DeviceClass.compact;

  /// `true` when the screen width is in the medium range (600–839dp).
  bool get isMedium => deviceClass == DeviceClass.medium;

  /// `true` when the screen width is in the expanded range (≥ 840dp).
  bool get isExpanded => deviceClass == DeviceClass.expanded;
}
