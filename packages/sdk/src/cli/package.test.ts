import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

describe('CLI package metadata', () => {
  it('exposes ttr as the primary command with tuturuuu and tutur3u aliases', () => {
    expect(packageJson.bin).toEqual({
      ttr: './dist/cli/index.js',
      tuturuuu: './dist/cli/index.js',
      tutur3u: './dist/cli/index.js',
    });
  });
});
