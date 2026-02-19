/// Material 3 adaptive device-class breakpoints.
enum DeviceClass { compact, medium, expanded }

/// Material 3 window-size-class boundaries.
class Breakpoints {
  const Breakpoints._();

  /// Minimum width for the *medium* window-size class (tablets).
  static const double mediumMin = 600;

  /// Minimum width for the *expanded* window-size class (laptops/desktops).
  static const double expandedMin = 840;

  /// Returns the [DeviceClass] for the given logical pixel [width].
  static DeviceClass fromWidth(double width) {
    if (width >= expandedMin) return DeviceClass.expanded;
    if (width >= mediumMin) return DeviceClass.medium;
    return DeviceClass.compact;
  }
}
