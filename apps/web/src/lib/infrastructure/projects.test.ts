import { describe, expect, it } from 'vitest';
import { parsePublicGitHubRepoUrl } from './projects';

describe('infrastructure projects', () => {
  it('normalizes public GitHub repository URLs', () => {
    expect(
      parsePublicGitHubRepoUrl('https://github.com/tutur3u/platform.git')
    ).toEqual({
      owner: 'tutur3u',
      repo: 'platform',
      repoUrl: 'https://github.com/tutur3u/platform',
    });
  });

  it('rejects non-GitHub repository URLs', () => {
    expect(() =>
      parsePublicGitHubRepoUrl('https://gitlab.com/tutur3u/platform')
    ).toThrow('Only public https://github.com repositories are supported.');
  });
});
