import 'dart:async';

import 'package:flutter/material.dart'
    hide NavigationBar, NavigationBarTheme, Scaffold;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/responsive/breakpoints.dart';
import 'package:mobile/core/responsive/responsive_values.dart';
import 'package:mobile/core/router/routes.dart';
import 'package:mobile/features/apps/cubit/app_tab_cubit.dart';
import 'package:mobile/features/apps/cubit/app_tab_state.dart';
import 'package:mobile/features/apps/registry/app_registry.dart';
import 'package:mobile/features/shell/view/avatar_dropdown.dart';
import 'package:mobile/features/workspace/cubit/workspace_cubit.dart';
import 'package:mobile/features/workspace/cubit/workspace_state.dart';
import 'package:mobile/features/workspace/widgets/workspace_picker_sheet.dart';
import 'package:mobile/l10n/l10n.dart';
import 'package:shadcn_flutter/shadcn_flutter.dart' as shad;

/// Shell layout with adaptive navigation.
///
/// Wraps all tab-level routes via GoRouter's [ShellRoute].
/// - **compact** → bottom [shad.NavigationBar]
/// - **medium**  → side [shad.NavigationRail]
/// - **expanded** → side [shad.NavigationSidebar]
class ShellPage extends StatefulWidget {
  const ShellPage({required this.child, super.key});

  final Widget child;

  @override
  State<ShellPage> createState() => _ShellPageState();
}

class _ShellPageState extends State<ShellPage> {
  static const ValueKey<String> _homeKey = ValueKey('home');
  static const ValueKey<String> _appsKey = ValueKey('apps');
  static const ValueKey<String> _assistantKey = ValueKey('assistant');

  final Stopwatch _tapStopwatch = Stopwatch();
  int? _lastTabIndex;
  Timer? _longPressTimer;
  final GlobalKey _appsTabKey = GlobalKey();

  bool _isAppsTabHit(Offset position) {
    final ctx = _appsTabKey.currentContext;
    if (ctx == null) return false;
    final renderBox = ctx.findRenderObject() as RenderBox?;
    if (renderBox == null || !renderBox.hasSize) return false;
    final overlay = Overlay.of(ctx).context.findRenderObject() as RenderBox?;
    if (overlay == null) return false;
    final topLeft = renderBox.localToGlobal(Offset.zero, ancestor: overlay);
    final bounds = topLeft & renderBox.size;
    return bounds.contains(position);
  }

  @override
  Widget build(BuildContext context) {
    final deviceClass = context.deviceClass;

    return BlocBuilder<AppTabCubit, AppTabState>(
      builder: (context, state) {
        if (deviceClass == DeviceClass.compact) {
          return _buildCompactLayout(context, state);
        }
        return _buildSideNavLayout(context, state, deviceClass);
      },
    );
  }

  Widget _buildNormalizedChild() {
    return MediaQuery.removePadding(
      context: context,
      removeTop: true,
      child: widget.child,
    );
  }

  /// Compact: bottom NavigationBar inside Scaffold footers.
  Widget _buildCompactLayout(BuildContext context, AppTabState state) {
    final l10n = context.l10n;
    final items = _buildNavItems(context, state, l10n);
    final selectedIndex = _calculateSelectedIndex(context);
    final selectedKey = _keyForIndex(selectedIndex);

    return shad.Scaffold(
      headers: [
        _buildAppBar(context, l10n),
      ],
      footers: [
        SafeArea(
          top: false,
          child: SizedBox(
            width: double.infinity,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Listener(
                  behavior: HitTestBehavior.translucent,
                  onPointerDown: _startLongPressTimer,
                  onPointerUp: _stopLongPressTimer,
                  onPointerCancel: _stopLongPressTimer,
                  child: shad.NavigationBar(
                    selectedKey: selectedKey,
                    alignment: shad.NavigationBarAlignment.spaceEvenly,
                    onSelected: (key) =>
                        _onItemTapped(_indexForKey(key), context, state),
                    children: items,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
      child: _buildNormalizedChild(),
    );
  }

  /// Medium / Expanded: side NavigationRail or NavigationSidebar.
  Widget _buildSideNavLayout(
    BuildContext context,
    AppTabState state,
    DeviceClass deviceClass,
  ) {
    final l10n = context.l10n;
    final selectedIndex = _calculateSelectedIndex(context);
    final selectedKey = _keyForIndex(selectedIndex);
    void onSelected(Key? key) =>
        _onItemTapped(_indexForKey(key), context, state);

    // Use non-GlobalKey for rail/sidebar items (no long-press detection).
    final items = _buildNavItems(context, state, l10n, useGlobalKey: false);

    final Widget sideNav;
    if (deviceClass == DeviceClass.expanded) {
      sideNav = shad.NavigationSidebar(
        selectedKey: selectedKey,
        onSelected: onSelected,
        children: items,
      );
    } else {
      sideNav = shad.NavigationRail(
        selectedKey: selectedKey,
        onSelected: onSelected,
        children: items,
      );
    }

    return shad.Scaffold(
      headers: [
        _buildAppBar(context, l10n),
      ],
      child: Row(
        children: [
          sideNav,
          Expanded(child: _buildNormalizedChild()),
        ],
      ),
    );
  }

  shad.AppBar _buildAppBar(BuildContext context, AppLocalizations l10n) {
    return shad.AppBar(
      title: BlocBuilder<WorkspaceCubit, WorkspaceState>(
        buildWhen: (prev, curr) =>
            prev.currentWorkspace != curr.currentWorkspace,
        builder: (context, state) {
          return shad.GhostButton(
            onPressed: () => showWorkspacePickerSheet(context),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    state.currentWorkspace?.name ?? l10n.appTitle,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const shad.Gap(4),
                const Icon(Icons.arrow_drop_down, size: 20),
              ],
            ),
          );
        },
      ),
      trailing: const [
        // Avatar dropdown
        AvatarDropdown(),
      ],
    );
  }

  /// Builds the three navigation items.
  ///
  /// When [useGlobalKey] is true (compact mode), the Apps item uses the
  /// [_appsTabKey] GlobalKey for long-press hit testing.
  List<shad.NavigationItem> _buildNavItems(
    BuildContext context,
    AppTabState state,
    AppLocalizations l10n, {
    bool useGlobalKey = true,
  }) {
    final theme = shad.Theme.of(context);
    final labelStyle = theme.typography.p.copyWith(
      fontSize: 12,
      fontWeight: FontWeight.normal,
    );

    final selectedModule = state.hasSelection
        ? AppRegistry.moduleById(state.selectedId)
        : null;
    final appsLabel = selectedModule?.label(l10n) ?? l10n.navApps;
    final appsIcon = selectedModule?.icon ?? Icons.apps_outlined;

    return [
      shad.NavigationItem(
        key: _homeKey,
        label: Text(
          l10n.navHome,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: labelStyle,
        ),
        child: const Icon(Icons.home_outlined),
      ),
      shad.NavigationItem(
        key: useGlobalKey ? _appsTabKey : _appsKey,
        label: Text(
          appsLabel,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: labelStyle,
        ),
        child: Icon(appsIcon),
      ),
      shad.NavigationItem(
        key: _assistantKey,
        label: Text(
          l10n.navAssistant,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: labelStyle,
        ),
        child: const Icon(Icons.auto_awesome_outlined),
      ),
    ];
  }

  @override
  void dispose() {
    _stopLongPressTimer();
    super.dispose();
  }

  void _handleAppsLongPress() {
    if (!context.mounted) return;
    unawaited(context.read<AppTabCubit>().openWithSearch());
    context.go(Routes.apps);
  }

  Future<void> _onItemTapped(
    int index,
    BuildContext context,
    AppTabState state,
  ) async {
    final isDoubleTap =
        _lastTabIndex == index &&
        _tapStopwatch.isRunning &&
        _tapStopwatch.elapsed < const Duration(milliseconds: 300);

    if (index == 1 && isDoubleTap) {
      await context.read<AppTabCubit>().clearSelection();
      if (context.mounted) context.go(Routes.apps);
      _lastTabIndex = index;
      _tapStopwatch
        ..reset()
        ..start();
      return;
    }

    final appRoute = state.hasSelection
        ? AppRegistry.moduleById(state.selectedId)?.route
        : null;
    final route = switch (index) {
      1 => appRoute ?? Routes.apps,
      2 => Routes.assistant,
      _ => Routes.home,
    };
    if (context.mounted) context.go(route);
    await context.read<AppTabCubit>().setLastTabRoute(route);
    _lastTabIndex = index;
    _tapStopwatch
      ..reset()
      ..start();
  }

  void _startLongPressTimer(PointerDownEvent event) {
    if (!_isAppsTabHit(event.position)) return;
    _stopLongPressTimer();
    _longPressTimer = Timer(
      const Duration(milliseconds: 500),
      _handleAppsLongPress,
    );
  }

  void _stopLongPressTimer([PointerEvent? _]) {
    _longPressTimer?.cancel();
    _longPressTimer = null;
  }

  Key _keyForIndex(int index) => switch (index) {
    1 => _appsTabKey,
    2 => _assistantKey,
    _ => _homeKey,
  };

  static int _indexForKey(Key? key) {
    if (key == _appsKey || key is GlobalKey) return 1;
    if (key == _assistantKey) return 2;
    return 0;
  }

  static int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;

    if (location.startsWith(Routes.apps)) return 1;
    if (AppRegistry.moduleFromLocation(location) != null) return 1;
    if (location.startsWith(Routes.assistant)) return 2;
    return 0; // home
  }
}
