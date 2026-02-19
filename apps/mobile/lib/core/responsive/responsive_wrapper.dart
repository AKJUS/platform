import 'package:flutter/widgets.dart';

/// Centers and constrains [child] when [maxWidth] is non-null.
///
/// When [maxWidth] is `null`, the child is rendered without any constraint
/// (noop), which is the expected behavior on compact screens.
class ResponsiveWrapper extends StatelessWidget {
  const ResponsiveWrapper({required this.child, this.maxWidth, super.key});

  final Widget child;
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    if (maxWidth == null) return child;
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth!),
        child: child,
      ),
    );
  }
}
