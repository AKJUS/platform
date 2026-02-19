import 'dart:async';

import 'package:flutter/material.dart' hide AlertDialog;
import 'package:mobile/core/responsive/responsive_values.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart' as shad;

/// Shows a bottom sheet on compact screens and a centered dialog on
/// medium / expanded screens.
///
/// The dialog variant is constrained to [maxDialogWidth] (default 560).
Future<T?> showAdaptiveSheet<T>({
  required BuildContext context,
  required Widget Function(BuildContext) builder,
  double maxDialogWidth = 560,
  bool isScrollControlled = true,
  bool useSafeArea = true,
}) {
  if (context.isCompact) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: isScrollControlled,
      useSafeArea: useSafeArea,
      builder: builder,
    );
  }

  return showDialog<T>(
    context: context,
    builder: (dialogContext) => Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxDialogWidth),
        child: Material(
          borderRadius: BorderRadius.circular(12),
          clipBehavior: Clip.antiAlias,
          child: builder(dialogContext),
        ),
      ),
    ),
  );
}

/// Opens a shadcn bottom drawer on compact screens and a centered dialog on
/// medium / expanded screens.
void showAdaptiveDrawer({
  required BuildContext context,
  required Widget Function(BuildContext) builder,
  double maxDialogWidth = 560,
}) {
  if (context.isCompact) {
    unawaited(
      shad.openDrawer<void>(
        context: context,
        position: shad.OverlayPosition.bottom,
        builder: builder,
      ),
    );
    return;
  }

  unawaited(
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxDialogWidth),
          child: Material(
            borderRadius: BorderRadius.circular(12),
            clipBehavior: Clip.antiAlias,
            child: builder(dialogContext),
          ),
        ),
      ),
    ),
  );
}
