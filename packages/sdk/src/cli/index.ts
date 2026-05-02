#!/usr/bin/env bun
import { runCli } from './commands';

runCli().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
