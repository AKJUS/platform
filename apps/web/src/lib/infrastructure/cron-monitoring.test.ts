import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readCronMonitoringSnapshot } from './cron-monitoring';

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_CRON_CONFIG_PATH = process.env.PLATFORM_WEB_CRON_CONFIG_PATH;

function restoreEnv() {
  process.chdir(ORIGINAL_CWD);

  if (ORIGINAL_CRON_CONFIG_PATH === undefined) {
    delete process.env.PLATFORM_WEB_CRON_CONFIG_PATH;
    return;
  }

  process.env.PLATFORM_WEB_CRON_CONFIG_PATH = ORIGINAL_CRON_CONFIG_PATH;
}

function writeCronConfig(configPath: string) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      jobs: [
        {
          description: 'Synchronize payment products.',
          enabled: true,
          id: 'payment-products',
          path: '/api/cron/payment/products',
          schedule: '0 */12 * * *',
        },
      ],
    })
  );
}

describe('readCronMonitoringSnapshot', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('reads cron config from a repo-root working directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cron-monitoring-'));

    try {
      writeCronConfig(path.join(tempDir, 'apps', 'web', 'cron.config.json'));
      process.chdir(tempDir);

      const snapshot = readCronMonitoringSnapshot();

      expect(snapshot.source.configAvailable).toBe(true);
      expect(snapshot.jobs).toHaveLength(1);
      expect(snapshot.jobs[0]?.id).toBe('payment-products');
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it('reads cron config from an app working directory in standalone runtimes', () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'cron-monitoring-app-cwd-')
    );
    const appDir = path.join(tempDir, 'apps', 'web');

    try {
      writeCronConfig(path.join(appDir, 'cron.config.json'));
      process.chdir(appDir);

      const snapshot = readCronMonitoringSnapshot();

      expect(snapshot.source.configAvailable).toBe(true);
      expect(snapshot.jobs).toHaveLength(1);
      expect(snapshot.jobs[0]?.path).toBe('/api/cron/payment/products');
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
