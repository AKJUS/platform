part of 'task_planning_page.dart';

extension _TaskPlanningNavigation on _TaskPlanningViewState {
  Widget _buildPlanningMiniNav(BuildContext context) {
    return ShellMiniNav(
      ownerId: 'task-planning-mini-nav',
      locations: const {Routes.taskPlanning},
      deepLinkBackRoute: Routes.tasks,
      items: [
        ShellMiniNavItemSpec(
          id: 'back',
          icon: Icons.chevron_left,
          label: context.l10n.navBack,
          callbackToken: 'back',
          onPressed: _openTasksApp,
        ),
        ShellMiniNavItemSpec(
          id: 'estimates',
          icon: Icons.calculate_outlined,
          label: context.l10n.taskEstimatesTitle,
          selected: _activeTab == _TaskPlanningTab.estimates,
          callbackToken: 'estimates-${_activeTab.name}',
          onPressed: () => _selectTab(_TaskPlanningTab.estimates),
        ),
        ShellMiniNavItemSpec(
          id: 'labels',
          icon: Icons.label_outline,
          label: context.l10n.taskLabelsTab,
          selected: _activeTab == _TaskPlanningTab.labels,
          callbackToken: 'labels-${_activeTab.name}',
          onPressed: () => _selectTab(_TaskPlanningTab.labels),
        ),
        ShellMiniNavItemSpec(
          id: 'projects',
          icon: Icons.folder_open_outlined,
          label: context.l10n.taskPortfolioProjectsTab,
          selected: _activeTab == _TaskPlanningTab.projects,
          callbackToken: 'projects-${_activeTab.name}',
          onPressed: () => _selectTab(_TaskPlanningTab.projects),
        ),
        ShellMiniNavItemSpec(
          id: 'initiatives',
          icon: Icons.account_tree_outlined,
          label: context.l10n.taskPortfolioInitiativesTab,
          selected: _activeTab == _TaskPlanningTab.initiatives,
          callbackToken: 'initiatives-${_activeTab.name}',
          onPressed: () => _selectTab(_TaskPlanningTab.initiatives),
        ),
      ],
    );
  }

  void _openTasksApp() {
    if (!mounted) {
      return;
    }
    context.go(Routes.tasks);
  }
}
