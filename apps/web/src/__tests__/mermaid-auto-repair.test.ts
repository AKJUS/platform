import { describe, expect, it } from 'vitest';
import {
  buildMermaidAutoRepairPrompt,
  extractMermaidBlocks,
  isAutoMermaidRepairPrompt,
  simpleStableHash,
} from '@/app/[locale]/(dashboard)/[wsId]/(dashboard)/components/mermaid-auto-repair';

describe('mermaid auto repair helpers', () => {
  it('extracts mermaid blocks from markdown', () => {
    const text = `
before
\`\`\`mermaid
graph TD
A --> B
\`\`\`
middle
\`\`\`mermaid
flowchart LR
X --> Y
\`\`\`
`;

    expect(extractMermaidBlocks(text)).toEqual([
      'graph TD\nA --> B',
      'flowchart LR\nX --> Y',
    ]);
  });

  it('builds a prefixed auto-repair prompt', () => {
    const prompt = buildMermaidAutoRepairPrompt({
      parseError: 'Parse error on line 2',
      originalDiagram: 'graph TD\nA -->',
    });

    expect(isAutoMermaidRepairPrompt(prompt)).toBe(true);
    expect(prompt).toContain('Parse error on line 2');
    expect(prompt).toContain('```mermaid');
  });

  it('generates stable hashes for equal input', () => {
    expect(simpleStableHash('abc')).toBe(simpleStableHash('abc'));
    expect(simpleStableHash('abc')).not.toBe(simpleStableHash('abcd'));
  });
});
