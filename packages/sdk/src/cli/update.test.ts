import { describe, expect, it, vi } from 'vitest';
import {
  checkForCliUpdate,
  compareVersions,
  shouldCheckForUpdate,
} from './update';

describe('CLI update checks', () => {
  it('compares multi-digit semantic versions correctly', () => {
    expect(compareVersions('0.10.0', '0.2.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
  });

  it('uses an hourly cache window for update checks', () => {
    expect(
      shouldCheckForUpdate({
        checkedAt: '2026-05-02T00:00:00.000Z',
        now: new Date('2026-05-02T00:30:00.000Z'),
      })
    ).toBe(false);

    expect(
      shouldCheckForUpdate({
        checkedAt: '2026-05-02T00:00:00.000Z',
        now: new Date('2026-05-02T01:00:00.000Z'),
      })
    ).toBe(true);
  });

  it('prints an update notice to stderr when a newer CLI is available', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ version: '0.3.0' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      })
    );
    const stderr = { write: vi.fn() };

    const result = await checkForCliUpdate({
      config: { baseUrl: 'https://tuturuuu.com' },
      currentVersion: '0.2.2',
      fetch,
      now: new Date('2026-05-02T00:00:00.000Z'),
      stderr,
    });

    expect(stderr.write).toHaveBeenCalledWith(
      expect.stringContaining(
        'A new Tuturuuu CLI version is available: 0.2.2 -> 0.3.0'
      )
    );
    expect(result.updateCheck).toEqual({
      checkedAt: '2026-05-02T00:00:00.000Z',
      latestVersion: '0.3.0',
    });
  });

  it('stays quiet when the registry cannot be reached', async () => {
    const stderr = { write: vi.fn() };

    const result = await checkForCliUpdate({
      config: { baseUrl: 'https://tuturuuu.com' },
      currentVersion: '0.2.2',
      fetch: vi.fn().mockRejectedValue(new Error('offline')),
      now: new Date('2026-05-02T00:00:00.000Z'),
      stderr,
    });

    expect(stderr.write).not.toHaveBeenCalled();
    expect(result.updateCheck?.checkedAt).toBe('2026-05-02T00:00:00.000Z');
  });
});
