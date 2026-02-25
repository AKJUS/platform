type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeElement(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;

  const element: AnyRecord = { ...raw };
  const rawProps = element.props;
  const props = isRecord(rawProps) ? { ...rawProps } : {};

  // Common model mistake: put bindings under props.bindings instead of element.bindings.
  if (!element.bindings && isRecord(props.bindings)) {
    element.bindings = props.bindings;
    delete props.bindings;
  }

  element.props = props;
  element.children = Array.isArray(element.children) ? element.children : [];

  return element;
}

function normalizeSpecLike(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  if (typeof raw.root !== 'string' || !isRecord(raw.elements)) return raw;

  const normalizedElements: AnyRecord = {};
  for (const [id, element] of Object.entries(raw.elements)) {
    normalizedElements[id] = normalizeElement(element);
  }

  return {
    ...raw,
    elements: normalizedElements,
  };
}

function getCandidates(value: AnyRecord): unknown[] {
  const candidates: unknown[] = [];
  const keys = [
    'json_schema',
    'spec',
    'schema',
    'output',
    'result',
    'data',
    'payload',
  ];

  for (const key of keys) {
    if (key in value) candidates.push(value[key]);
  }

  if (typeof value.json === 'string') {
    const parsed = safeParseJson(value.json);
    if (parsed !== null) candidates.push(parsed);
  } else if (value.json !== undefined) {
    candidates.push(value.json);
  }

  return candidates;
}

/**
 * Normalize model-generated render_ui inputs before zod validation.
 * Handles common wrappers and structural mistakes while preserving unknown fields.
 */
export function normalizeRenderUiInputForTool(input: unknown): unknown {
  const queue: unknown[] = [input];
  const visited = new WeakSet<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined) continue;

    if (typeof current === 'string') {
      const parsed = safeParseJson(current);
      if (parsed !== null) {
        queue.push(parsed);
      }
      continue;
    }

    if (!isRecord(current)) continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const normalized = normalizeSpecLike(current);
    if (normalized !== current) return normalized;

    queue.push(...getCandidates(current));
  }

  return input;
}
