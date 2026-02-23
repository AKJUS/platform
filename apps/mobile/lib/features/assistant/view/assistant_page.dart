import 'package:flutter/material.dart' hide Scaffold;
import 'package:mobile/core/responsive/responsive_padding.dart';
import 'package:mobile/core/responsive/responsive_values.dart';
import 'package:mobile/core/responsive/responsive_wrapper.dart';
import 'package:mobile/l10n/l10n.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart' as shad;

class AssistantPage extends StatelessWidget {
  const AssistantPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return shad.Scaffold(
      child: SafeArea(
        child: ResponsiveWrapper(
          maxWidth: ResponsivePadding.maxContentWidth(context.deviceClass),
          child: Center(
            child: Padding(
              padding: EdgeInsets.all(
                ResponsivePadding.horizontal(context.deviceClass),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.auto_awesome_outlined, size: 40),
                  const shad.Gap(12),
                  Text(
                    l10n.navAssistant,
                    style: shad.Theme.of(context).typography.h4,
                  ),
                  const shad.Gap(8),
                  Text(
                    l10n.assistantComingSoon,
                    style: shad.Theme.of(context).typography.textMuted,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
