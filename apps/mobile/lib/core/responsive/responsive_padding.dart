import 'package:mobile/core/responsive/breakpoints.dart';

/// Device-class-aware spacing and max-width constants.
class ResponsivePadding {
  const ResponsivePadding._();

  /// Horizontal page padding that increases with screen width.
  static double horizontal(DeviceClass deviceClass) => switch (deviceClass) {
    DeviceClass.compact => 16,
    DeviceClass.medium => 24,
    DeviceClass.expanded => 32,
  };

  /// Maximum content width for general pages.
  ///
  /// Returns `null` on compact (no constraint), so callers can skip wrapping.
  static double? maxContentWidth(DeviceClass deviceClass) =>
      switch (deviceClass) {
        DeviceClass.compact => null,
        DeviceClass.medium => 600,
        DeviceClass.expanded => 720,
      };

  /// Maximum width for form layouts (auth pages, settings).
  static double maxFormWidth(DeviceClass deviceClass) => switch (deviceClass) {
    DeviceClass.compact => double.infinity,
    DeviceClass.medium => 480,
    DeviceClass.expanded => 480,
  };
}
