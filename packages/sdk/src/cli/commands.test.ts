import { afterEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../package.json';
import { runCli } from './commands';

describe('CLI commands', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['-v', '--version'])('prints version for %s', async (flag) => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await runCli([flag]);

    expect(write).toHaveBeenCalledWith(`${packageJson.version}\n`);
  });
});
