import { z } from 'zod';
import { tool } from '../core';
import { dashboardCatalog } from '../json-render-catalog';
import { normalizeRenderUiInputForTool } from '../normalize-render-ui-input';

export const renderUiToolDefinitions = {
  render_ui: tool({
    description:
      'Generate an interactive, actionable UI component or widget using json-render instead of plain text. Use this when the user asks for a dashboard, a form, or whenever a beautifully rendered visual response would complement and significantly improve the user experience (e.g. for status summaries, lists, or visualizations). You MUST output a JSON object matching the schema exactly — do NOT wrap it in a "json" string.',
    inputSchema: z.preprocess(
      (val: unknown) => normalizeRenderUiInputForTool(val),
      dashboardCatalog.zodSchema()
    ),
  }),
} as const;
