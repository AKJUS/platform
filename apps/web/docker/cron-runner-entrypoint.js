#!/usr/bin/env bun

const path = require('node:path');
const { spawn } = require('node:child_process');

const WORKSPACE_DIR =
  process.env.PLATFORM_HOST_WORKSPACE_DIR?.trim() || '/workspace';
const RUNNER_SCRIPT_PATH = path.join(
  WORKSPACE_DIR,
  'scripts',
  'watch-web-crons.js'
);
const RESTART_DELAY_MS = Number.parseInt(
  process.env.PLATFORM_CRON_RUNNER_RESTART_DELAY_MS || '5000',
  10
);

let activeChild = null;
let stopRequested = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce() {
  return new Promise((resolve) => {
    const child = spawn(
      'bun',
      [
        RUNNER_SCRIPT_PATH,
        '--interval-ms',
        process.env.PLATFORM_CRON_RUNNER_INTERVAL_MS || '30000',
      ],
      {
        cwd: WORKSPACE_DIR,
        env: process.env,
        stdio: 'inherit',
      }
    );
    activeChild = child;

    child.on('close', (code, signal) => {
      activeChild = null;
      resolve({ code: code ?? 1, signal: signal ?? null });
    });
  });
}

async function main() {
  while (!stopRequested) {
    const result = await runOnce();

    if (stopRequested) {
      return;
    }

    console.error(
      `Cron runner exited with ${result.signal ?? result.code}; restarting.`
    );
    await sleep(
      Number.isFinite(RESTART_DELAY_MS) && RESTART_DELAY_MS > 0
        ? RESTART_DELAY_MS
        : 5000
    );
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopRequested = true;
    activeChild?.kill(signal);
  });
}

void main();
