import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile/features/shell/cubit/shell_title_override_cubit.dart';

class ShellTitleOverride extends StatefulWidget {
  const ShellTitleOverride({
    required this.ownerId,
    required this.locations,
    required this.title,
    super.key,
    this.showLeadingBrand = true,
    this.showAvatar = true,
    this.onTitleSubmitted,
  });

  final String ownerId;
  final Set<String> locations;
  final String title;
  final bool showLeadingBrand;
  final bool showAvatar;
  final Future<void> Function(String title)? onTitleSubmitted;

  @override
  State<ShellTitleOverride> createState() => _ShellTitleOverrideState();
}

class _ShellTitleOverrideState extends State<ShellTitleOverride> {
  ShellTitleOverrideCubit? _cubit;
  bool _disposed = false;
  bool _syncScheduled = false;
  late final String _registrationId =
      '${widget.ownerId}#${identityHashCode(this)}';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final nextCubit = lookupShellTitleOverrideCubit(context);
    if (_cubit != nextCubit) {
      _scheduleUnregister(_cubit);
      _cubit = nextCubit;
    }
    _scheduleSyncRegistration();
  }

  @override
  void didUpdateWidget(covariant ShellTitleOverride oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!setEquals(oldWidget.locations, widget.locations) ||
        oldWidget.ownerId != widget.ownerId ||
        oldWidget.title != widget.title ||
        oldWidget.showLeadingBrand != widget.showLeadingBrand ||
        oldWidget.showAvatar != widget.showAvatar ||
        oldWidget.onTitleSubmitted != widget.onTitleSubmitted) {
      _scheduleSyncRegistration();
    }
  }

  void _scheduleSyncRegistration() {
    if (_syncScheduled) {
      return;
    }
    _syncScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _syncScheduled = false;
      if (_disposed || !mounted || (_cubit?.isClosed ?? true)) {
        return;
      }
      _syncRegistration();
    });
  }

  void _syncRegistration() {
    _cubit?.register(
      registrationId: _registrationId,
      ownerId: widget.ownerId,
      locations: widget.locations,
      title: widget.title,
      showLeadingBrand: widget.showLeadingBrand,
      showAvatar: widget.showAvatar,
      onTitleSubmitted: widget.onTitleSubmitted,
    );
  }

  void _scheduleUnregister(ShellTitleOverrideCubit? cubit) {
    if (cubit == null) {
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (cubit.isClosed) {
        return;
      }
      cubit.unregister(_registrationId);
    });
  }

  @override
  void dispose() {
    _disposed = true;
    _scheduleUnregister(_cubit);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

ShellTitleOverrideCubit? lookupShellTitleOverrideCubit(BuildContext context) {
  var hasProvider = false;
  context.visitAncestorElements((element) {
    if (element.widget is BlocProvider<ShellTitleOverrideCubit>) {
      hasProvider = true;
      return false;
    }
    return true;
  });
  if (!hasProvider) {
    return null;
  }

  return BlocProvider.of<ShellTitleOverrideCubit>(context);
}
