import 'dart:async';

import 'package:flutter/material.dart'
    hide AlertDialog, AppBar, FilledButton, Scaffold, TextButton;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile/features/auth/cubit/auth_cubit.dart';
import 'package:mobile/features/auth/cubit/auth_state.dart';
import 'package:mobile/features/auth/widgets/auth_scaffold.dart';
import 'package:mobile/l10n/l10n.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart' as shad;

class MfaVerifyPage extends StatefulWidget {
  const MfaVerifyPage({super.key});

  @override
  State<MfaVerifyPage> createState() => _MfaVerifyPageState();
}

class _MfaVerifyPageState extends State<MfaVerifyPage> {
  final _codeController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _handleVerify() async {
    final code = _codeController.text.trim();
    if (code.length != 6) return;

    final success = await context.read<AuthCubit>().verifyMfa(code);
    if (!success && mounted) {
      _codeController.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = shad.Theme.of(context);

    return AuthScaffold(
      title: l10n.mfaTitle,
      child: BlocBuilder<AuthCubit, AuthState>(
        buildWhen: (prev, curr) =>
            prev.isLoading != curr.isLoading || prev.error != curr.error,
        builder: (context, state) {
          return Column(
            children: [
              Text(
                l10n.mfaSubtitle,
                style: theme.typography.textMuted.copyWith(fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const shad.Gap(32),
              shad.InputOTP(
                onChanged: (v) {
                  _codeController.text = v.otpToString();
                  if (v.otpToString().length == 6) {
                    unawaited(_handleVerify());
                  }
                },
                children: [
                  shad.InputOTPChild.character(allowDigit: true),
                  shad.InputOTPChild.character(allowDigit: true),
                  shad.InputOTPChild.character(allowDigit: true),
                  shad.InputOTPChild.separator,
                  shad.InputOTPChild.character(allowDigit: true),
                  shad.InputOTPChild.character(allowDigit: true),
                  shad.InputOTPChild.character(allowDigit: true),
                ],
              ),
              if (state.error != null) ...[
                const shad.Gap(16),
                Text(
                  state.error!,
                  style: theme.typography.small.copyWith(
                    color: theme.colorScheme.destructive,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
              const shad.Gap(32),
              SizedBox(
                width: double.infinity,
                child: shad.PrimaryButton(
                  onPressed: state.isLoading ? null : _handleVerify,
                  child: state.isLoading
                      ? const shad.CircularProgressIndicator(size: 20)
                      : Text(l10n.mfaVerify),
                ),
              ),
              const shad.Gap(16),
              _SignOutButton(l10n: l10n),
            ],
          );
        },
      ),
    );
  }
}

class _SignOutButton extends StatelessWidget {
  const _SignOutButton({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: shad.GhostButton(
        onPressed: () {
          unawaited(context.read<AuthCubit>().signOut());
        },
        child: Text(l10n.mfaSignOut),
      ),
    );
  }
}
