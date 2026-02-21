import 'package:flutter/material.dart' hide AppBar, Scaffold;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile/features/auth/cubit/auth_cubit.dart';
import 'package:mobile/l10n/l10n.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart' as shad;
import 'package:supabase_flutter/supabase_flutter.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final user = context.select<AuthCubit, User?>((cubit) => cubit.state.user);

    return shad.Scaffold(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.person, size: 64),
            const shad.Gap(16),
            Text(
              user?.email ?? l10n.profileTitle,
              style: shad.Theme.of(context).typography.h3,
            ),
            const shad.Gap(8),
            Text(
              'User ID: ${user?.id ?? "Unknown"}',
              style: shad.Theme.of(context).typography.textMuted,
            ),
          ],
        ),
      ),
    );
  }
}
