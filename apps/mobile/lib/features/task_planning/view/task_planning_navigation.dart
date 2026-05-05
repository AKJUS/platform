part of 'task_planning_page.dart';

extension _TaskPlanningNavigation on _TaskPlanningViewState {
  Widget _buildPersonalMiniNav(BuildContext context) {
    return ShellMiniNav(
      ownerId: 'personal-task-planning-mini-nav',
      locations: const {Routes.taskPlanning},
      deepLinkBackRoute: Routes.apps,
      items: [
        ShellMiniNavItemSpec(
          id: 'back',
          icon: Icons.chevron_left,
          label: context.l10n.navBack,
          callbackToken: 'back',
          onPressed: () => context.go(Routes.apps),
        ),
        ShellMiniNavItemSpec(
          id: 'tasks',
          icon: shad.LucideIcons.userCheck,
          label: context.l10n.navTasks,
          enabled: !_isLoadingPersonalDefaultBoard,
          callbackToken: 'tasks-${_personalDefaultBoardId ?? ''}',
          onPressed: () => _openPersonalBoardView(taskBoardDetailViewList),
        ),
        ShellMiniNavItemSpec(
          id: 'kanban',
          icon: Icons.view_kanban_outlined,
          label: context.l10n.taskBoardDetailKanbanView,
          enabled: !_isLoadingPersonalDefaultBoard,
          callbackToken: 'kanban-${_personalDefaultBoardId ?? ''}',
          onPressed: () => _openPersonalBoardView(taskBoardDetailViewKanban),
        ),
        ShellMiniNavItemSpec(
          id: 'timeline',
          icon: Icons.timeline_outlined,
          label: context.l10n.taskBoardDetailTimelineView,
          enabled: !_isLoadingPersonalDefaultBoard,
          callbackToken: 'timeline-${_personalDefaultBoardId ?? ''}',
          onPressed: () => _openPersonalBoardView(taskBoardDetailViewTimeline),
        ),
        ShellMiniNavItemSpec(
          id: 'planning',
          icon: Icons.route_outlined,
          label: context.l10n.taskPlanningTitle,
          selected: true,
          callbackToken: 'planning',
        ),
      ],
    );
  }

  Future<void> _loadPersonalDefaultBoardIfNeeded(Workspace? workspace) async {
    if (workspace == null || !workspace.personal) {
      if (!mounted) return;
      _updateState(() {
        _personalDefaultBoardWorkspaceId = workspace?.id;
        _personalDefaultBoardId = null;
        _isLoadingPersonalDefaultBoard = false;
      });
      return;
    }
    if (_personalDefaultBoardWorkspaceId == workspace.id &&
        _personalDefaultBoardId != null) {
      return;
    }

    final capturedWorkspaceId = workspace.id;
    if (mounted) {
      _updateState(() {
        _personalDefaultBoardWorkspaceId = capturedWorkspaceId;
        _isLoadingPersonalDefaultBoard = true;
      });
    }

    try {
      final page = await _taskRepository.getTaskBoards(
        capturedWorkspaceId,
        pageSize: 50,
        status: 'active',
      );
      if (!mounted) return;
      final currentWorkspace = context
          .read<WorkspaceCubit>()
          .state
          .currentWorkspace;
      if (currentWorkspace?.id != capturedWorkspaceId) return;
      _updateState(() {
        _personalDefaultBoardId = preferredPersonalTaskBoard(page.boards)?.id;
        _isLoadingPersonalDefaultBoard = false;
      });
    } on Exception {
      if (!mounted) return;
      final currentWorkspace = context
          .read<WorkspaceCubit>()
          .state
          .currentWorkspace;
      if (currentWorkspace?.id != capturedWorkspaceId) return;
      _updateState(() {
        _personalDefaultBoardId = null;
        _isLoadingPersonalDefaultBoard = false;
      });
    }
  }

  void _openPersonalBoardView(String view) {
    final boardId = _personalDefaultBoardId;
    if (boardId == null || boardId.isEmpty) {
      context.go(Routes.tasks);
      return;
    }
    context.go(taskBoardViewLocation(boardId: boardId, view: view));
  }
}
