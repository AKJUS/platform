import type { UIMessage } from '@tuturuuu/ai/types';
import { getToolName, isToolUIPart } from 'ai';
import type { RenderGroup, ToolPartData } from './types';

export function groupMessageParts(parts: UIMessage['parts']): RenderGroup[] {
  if (!parts) return [];

  const groups: RenderGroup[] = [];
  let currentToolGroup: {
    toolName: string;
    parts: ToolPartData[];
    startIndex: number;
  } | null = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;

    if (isToolUIPart(part)) {
      const name = getToolName(part as never);
      if (name === 'no_action_needed') continue;
      if (currentToolGroup && currentToolGroup.toolName === name) {
        currentToolGroup.parts.push(part as ToolPartData);
      } else {
        if (currentToolGroup) {
          groups.push({ kind: 'tool', ...currentToolGroup });
        }
        currentToolGroup = {
          toolName: name,
          parts: [part as ToolPartData],
          startIndex: i,
        };
      }
    } else {
      if (currentToolGroup) {
        groups.push({ kind: 'tool', ...currentToolGroup });
        currentToolGroup = null;
      }
      if (
        part.type === 'text' &&
        (typeof (part as { text: string }).text === 'string'
          ? (part as { text: string }).text.trim()
          : true)
      ) {
        groups.push({
          kind: 'text',
          text: (part as { text: string }).text,
          index: i,
        });
      } else if (
        part.type === 'reasoning' &&
        (typeof (part as { text: string }).text === 'string'
          ? (part as { text: string }).text.trim()
          : true)
      ) {
        groups.push({
          kind: 'reasoning',
          text: (part as { text: string }).text,
          index: i,
        });
      } else {
        groups.push({ kind: 'other', index: i });
      }
    }
  }

  if (currentToolGroup) {
    groups.push({ kind: 'tool', ...currentToolGroup });
  }

  return groups;
}
