import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/router/routes.dart';
import 'package:mobile/data/models/task_estimate_board.dart';
import 'package:mobile/data/models/workspace.dart';
import 'package:mobile/data/repositories/task_repository.dart';
import 'package:mobile/data/repositories/workspace_permissions_repository.dart';
import 'package:mobile/features/auth/cubit/auth_cubit.dart';
import 'package:mobile/features/auth/cubit/auth_state.dart';
import 'package:mobile/features/shell/cubit/shell_mini_nav_cubit.dart';
import 'package:mobile/features/task_planning/view/task_planning_page.dart';
import 'package:mobile/features/task_portfolio/cubit/task_portfolio_cubit.dart';
import 'package:mobile/features/tasks_estimates/cubit/task_estimates_cubit.dart';
import 'package:mobile/features/tasks_estimates/cubit/task_labels_cubit.dart';
import 'package:mobile/features/workspace/cubit/workspace_cubit.dart';
import 'package:mobile/features/workspace/cubit/workspace_state.dart';
import 'package:mocktail/mocktail.dart';

import '../../../helpers/helpers.dart';

class _MockAuthCubit extends MockCubit<AuthState> implements AuthCubit {}

class _MockWorkspaceCubit extends MockCubit<WorkspaceState>
    implements WorkspaceCubit {}

class _MockTaskEstimatesCubit extends MockCubit<TaskEstimatesState>
    implements TaskEstimatesCubit {}

class _MockTaskLabelsCubit extends MockCubit<TaskLabelsState>
    implements TaskLabelsCubit {}

class _MockTaskPortfolioCubit extends MockCubit<TaskPortfolioState>
    implements TaskPortfolioCubit {}

class _MockWorkspacePermissionsRepository extends Mock
    implements WorkspacePermissionsRepository {}

void main() {
  group('TaskPlanningView', () {
    testWidgets('uses shell mini nav for planning modes', (tester) async {
      final authCubit = _MockAuthCubit();
      final workspaceCubit = _MockWorkspaceCubit();
      final estimatesCubit = _MockTaskEstimatesCubit();
      final labelsCubit = _MockTaskLabelsCubit();
      final portfolioCubit = _MockTaskPortfolioCubit();
      final permissionsRepository = _MockWorkspacePermissionsRepository();

      const workspace = Workspace(
        id: 'ws-1',
        name: 'Personal',
        personal: true,
      );
      const workspaceState = WorkspaceState(
        status: WorkspaceStatus.loaded,
        currentWorkspace: workspace,
        workspaces: [workspace],
      );
      final estimatesState = TaskEstimatesState(
        status: TaskEstimatesStatus.loaded,
        boards: [
          TaskEstimateBoard(
            id: 'board-1',
            name: 'Tasks',
            createdAt: DateTime(2026, 5, 5),
          ),
        ],
      );

      whenListen(
        authCubit,
        const Stream<AuthState>.empty(),
        initialState: const AuthState.unauthenticated(),
      );
      whenListen(
        workspaceCubit,
        const Stream<WorkspaceState>.empty(),
        initialState: workspaceState,
      );
      whenListen(
        estimatesCubit,
        const Stream<TaskEstimatesState>.empty(),
        initialState: estimatesState,
      );
      whenListen(
        labelsCubit,
        const Stream<TaskLabelsState>.empty(),
        initialState: const TaskLabelsState(status: TaskLabelsStatus.loaded),
      );
      whenListen(
        portfolioCubit,
        const Stream<TaskPortfolioState>.empty(),
        initialState: const TaskPortfolioState(
          status: TaskPortfolioStatus.loaded,
          workspaceId: 'ws-1',
        ),
      );

      addTearDown(authCubit.close);
      addTearDown(workspaceCubit.close);
      addTearDown(estimatesCubit.close);
      addTearDown(labelsCubit.close);
      addTearDown(portfolioCubit.close);

      await tester.pumpApp(
        RepositoryProvider(
          create: (_) => TaskRepository(),
          child: MultiBlocProvider(
            providers: [
              BlocProvider<AuthCubit>.value(value: authCubit),
              BlocProvider<WorkspaceCubit>.value(value: workspaceCubit),
              BlocProvider<TaskEstimatesCubit>.value(value: estimatesCubit),
              BlocProvider<TaskLabelsCubit>.value(value: labelsCubit),
              BlocProvider<TaskPortfolioCubit>.value(value: portfolioCubit),
              BlocProvider(create: (_) => ShellMiniNavCubit()),
            ],
            child: TaskPlanningView(
              permissionsRepository: permissionsRepository,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(SegmentedButton), findsNothing);

      final miniNavCubit = BlocProvider.of<ShellMiniNavCubit>(
        tester.element(find.byType(TaskPlanningView)),
      );
      var miniNav = miniNavCubit.state.resolveForLocation(Routes.taskPlanning);

      expect(miniNav, isNotNull);
      expect(
        miniNav!.items.map((item) => item.id),
        ['back', 'estimates', 'labels', 'projects', 'initiatives'],
      );
      expect(
        miniNav.items.firstWhere((item) => item.id == 'estimates').selected,
        isTrue,
      );

      miniNav.items
          .firstWhere((item) => item.id == 'projects')
          .onPressed
          ?.call();
      await tester.pumpAndSettle();

      miniNav = miniNavCubit.state.resolveForLocation(Routes.taskPlanning);
      expect(
        miniNav!.items.firstWhere((item) => item.id == 'projects').selected,
        isTrue,
      );
    });
  });
}
