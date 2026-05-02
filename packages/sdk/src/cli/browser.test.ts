import { describe, expect, it } from 'vitest';
import { getOpenBrowserCommand } from './browser';

describe('browser opener command selection', () => {
  it('uses open on macOS', () => {
    expect(getOpenBrowserCommand('darwin', 'https://tuturuuu.com')).toEqual({
      command: 'open',
      args: ['https://tuturuuu.com'],
    });
  });

  it('uses cmd start on Windows', () => {
    expect(getOpenBrowserCommand('win32', 'https://tuturuuu.com')).toEqual({
      command: 'cmd',
      args: ['/c', 'start', '', 'https://tuturuuu.com'],
    });
  });

  it('uses xdg-open on Linux', () => {
    expect(getOpenBrowserCommand('linux', 'https://tuturuuu.com')).toEqual({
      command: 'xdg-open',
      args: ['https://tuturuuu.com'],
    });
  });
});
