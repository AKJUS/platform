import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/router/routes.dart';
import 'package:mobile/features/security/cubit/app_lock_cubit.dart';
import 'package:mobile/features/settings/view/settings_widgets.dart';
import 'package:mobile/l10n/l10n.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart' as shad;

class SessionSettingsSection extends StatelessWidget {
  const SessionSettingsSection({
    required this.onSignOut,
    super.key,
  });

  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final appLockState = context.watch<AppLockCubit>().state;
    final appLockEnabled = appLockState.enabled;

    return SettingsSection(
      title: l10n.settingsDangerSectionTitle,
      description: l10n.settingsDangerSectionDescription,
      children: [
        SettingsTile(
          icon: Icons.lock_outline_rounded,
          title: l10n.appLockSettingsTitle,
          subtitle: appLockState.status == AppLockStatus.unavailable
              ? l10n.appLockUnavailableDescription
              : l10n.appLockSettingsDescription,
          value: appLockEnabled
              ? l10n.appLockSettingsEnabled
              : l10n.appLockSettingsDisabled,
          showChevron: false,
          trailing: IgnorePointer(
            child: shad.Switch(
              value: appLockEnabled,
              onChanged: (_) {},
            ),
          ),
          onTap: () {
            final nextValue = !appLockEnabled;
            unawaited(
              context.read<AppLockCubit>().setEnabled(
                enabled: nextValue,
                reason: nextValue
                    ? l10n.appLockEnableReason
                    : l10n.appLockDisableReason,
              ),
            );
          },
        ),
        SettingsTile(
          icon: Icons.qr_code_scanner_rounded,
          title: l10n.qrLoginSettingsTitle,
          subtitle: appLockEnabled
              ? l10n.qrLoginSettingsDescription
              : l10n.qrLoginSettingsDisabledDescription,
          onTap: appLockEnabled
              ? () => context.push(Routes.settingsQrLoginScan)
              : null,
        ),
        SettingsTile(
          icon: Icons.logout_rounded,
          title: l10n.authLogOutCurrent,
          subtitle: l10n.authLogOutCurrentDescription,
          isDestructive: true,
          onTap: onSignOut,
        ),
      ],
    );
  }
}
