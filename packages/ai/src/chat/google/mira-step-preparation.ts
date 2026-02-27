import {
  buildActiveToolsFromSelected,
  extractSelectedToolsFromSteps,
  hasRenderableRenderUiInSteps,
  hasToolCallInSteps,
  wasToolEverSelectedInSteps,
} from '../mira-render-ui-policy';

export type PrepareMiraToolStepInput = {
  steps: unknown[];
  forceGoogleSearch: boolean;
  forceRenderUi: boolean;
  preferMarkdownTables: boolean;
};

export function prepareMiraToolStep({
  steps,
  forceGoogleSearch,
  forceRenderUi,
  preferMarkdownTables,
}: PrepareMiraToolStepInput): {
  toolChoice?: 'required';
  activeTools: string[];
} {
  if (steps.length === 0) {
    return {
      toolChoice: 'required',
      activeTools: ['select_tools'],
    };
  }

  const selectedTools = extractSelectedToolsFromSteps(steps);
  const filterRenderUiForMarkdownTables =
    preferMarkdownTables && !forceRenderUi;
  const filterSearchForMarkdownTables =
    preferMarkdownTables && !forceGoogleSearch;
  const normalizedSelectedTools = selectedTools.filter(
    (toolName) =>
      !(filterRenderUiForMarkdownTables && toolName === 'render_ui') &&
      !(filterSearchForMarkdownTables && toolName === 'google_search')
  );

  if (forceGoogleSearch && !hasToolCallInSteps(steps, 'google_search')) {
    const active = buildActiveToolsFromSelected(normalizedSelectedTools)
      .filter((toolName) => toolName !== 'no_action_needed')
      .concat('google_search', 'select_tools');

    return {
      toolChoice: 'required',
      activeTools: Array.from(new Set(active)),
    };
  }

  if (
    forceRenderUi &&
    !preferMarkdownTables &&
    !hasRenderableRenderUiInSteps(steps)
  ) {
    const active = [
      ...normalizedSelectedTools.filter(
        (toolName) =>
          toolName !== 'select_tools' && toolName !== 'no_action_needed'
      ),
      'render_ui',
      'select_tools',
    ];

    return {
      toolChoice: 'required',
      activeTools: Array.from(new Set(active)),
    };
  }

  const renderUiSelectedEver =
    normalizedSelectedTools.includes('render_ui') ||
    wasToolEverSelectedInSteps(steps, 'render_ui');
  if (
    renderUiSelectedEver &&
    !preferMarkdownTables &&
    !hasRenderableRenderUiInSteps(steps)
  ) {
    const active = buildActiveToolsFromSelected(normalizedSelectedTools)
      .filter((toolName) => toolName !== 'no_action_needed')
      .concat('render_ui', 'select_tools');
    return {
      toolChoice: 'required',
      activeTools: Array.from(new Set(active)),
    };
  }

  if (hasRenderableRenderUiInSteps(steps)) {
    const active = buildActiveToolsFromSelected(normalizedSelectedTools)
      .filter((toolName) => toolName !== 'render_ui')
      .concat('select_tools');
    return {
      activeTools: Array.from(new Set(active)),
    };
  }

  return {
    activeTools: buildActiveToolsFromSelected(normalizedSelectedTools),
  };
}
