export interface SelectItemOptions<T> {
  defaultIndex?: number;
  getDescription?: (item: T) => string | undefined;
  getLabel: (item: T) => string;
  items: T[];
  title: string;
}

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(index, Math.max(0, length - 1)));
}

function isRawModeCapable(
  stream: NodeJS.ReadStream
): stream is NodeJS.ReadStream & { setRawMode: (mode: boolean) => void } {
  return typeof stream.setRawMode === 'function';
}

export async function selectItem<T>({
  defaultIndex = 0,
  getDescription,
  getLabel,
  items,
  title,
}: SelectItemOptions<T>) {
  if (items.length === 0) {
    throw new Error('Nothing to select.');
  }

  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error(
      'Interactive selection requires a TTY. Pass an explicit id.'
    );
  }

  if (!isRawModeCapable(process.stdin)) {
    throw new Error('Interactive selection is not supported in this terminal.');
  }

  let selectedIndex = clampIndex(defaultIndex, items.length);
  let renderedLines = 0;

  return new Promise<T>((resolve, reject) => {
    const write = (value: string) => process.stderr.write(value);

    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      write('\x1b[?25h');
    };

    const render = () => {
      if (renderedLines > 0) {
        write(`\x1b[${renderedLines}F`);
      }
      write('\x1b[J\x1b[?25l');

      const lines = [
        title,
        'Use up/down or j/k to move, space/enter to select, q/esc to cancel.',
        '',
        ...items.map((item, index) => {
          const prefix = index === selectedIndex ? '>' : ' ';
          const label = getLabel(item);
          const description = getDescription?.(item);
          return description
            ? `${prefix} ${label}  ${description}`
            : `${prefix} ${label}`;
        }),
      ];

      renderedLines = lines.length;
      write(`${lines.join('\n')}\n`);
    };

    function rejectSelection(error: Error) {
      cleanup();
      reject(error);
    }

    function resolveSelection() {
      const selected = items[selectedIndex];
      if (!selected) {
        rejectSelection(new Error('No item selected.'));
        return;
      }

      cleanup();
      process.stderr.write('\n');
      resolve(selected);
    }

    function onData(data: Buffer) {
      const input = data.toString('utf8');

      if (input === '\u0003') {
        rejectSelection(new Error('Selection cancelled.'));
        return;
      }

      if (input === '\r' || input === '\n' || input === ' ') {
        resolveSelection();
        return;
      }

      if (input === '\u001b' || input === 'q') {
        rejectSelection(new Error('Selection cancelled.'));
        return;
      }

      if (input === '\u001b[A' || input === 'k') {
        selectedIndex =
          selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
        render();
        return;
      }

      if (input === '\u001b[B' || input === 'j') {
        selectedIndex =
          selectedIndex >= items.length - 1 ? 0 : selectedIndex + 1;
        render();
      }
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
    render();
  });
}
