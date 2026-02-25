export function isRenderableRenderUiSpec(
  value: Record<string, unknown> | undefined
): boolean {
  if (!value) return false;
  if (typeof value.root !== 'string' || value.root.length === 0) return false;

  const elements = value.elements;
  if (!elements || typeof elements !== 'object' || Array.isArray(elements)) {
    return false;
  }

  const elementEntries = Object.entries(elements);
  if (elementEntries.length === 0) return false;
  if (!(value.root in elements)) return false;

  const rootElement = (elements as Record<string, unknown>)[value.root];
  return (
    !!rootElement &&
    typeof rootElement === 'object' &&
    !Array.isArray(rootElement)
  );
}

export function buildRenderUiRecoverySpec(args: Record<string, unknown>) {
  const requestedRoot =
    typeof args.root === 'string' && args.root.trim().length > 0
      ? args.root.trim()
      : 'render_ui_recovery_root';

  return {
    root: requestedRoot,
    elements: {
      [requestedRoot]: {
        type: 'Callout',
        props: {
          title: 'UI unavailable',
          variant: 'warning',
          content:
            'Could not render the generated UI spec. Please retry this request.',
        },
        children: [],
      },
    },
  };
}

export function buildRenderUiFailsafeSpec(args: Record<string, unknown>) {
  const requestedRoot =
    typeof args.root === 'string' && args.root.trim().length > 0
      ? args.root.trim()
      : 'render_ui_failsafe_root';

  return {
    root: requestedRoot,
    elements: {
      [requestedRoot]: {
        type: 'Callout',
        props: {
          title: 'UI unavailable',
          variant: 'warning',
          content:
            'Could not render the generated UI spec. Please retry this request.',
        },
        children: [],
      },
    },
  };
}
