#!/usr/bin/env node

const { syncWebCrons } = require('./web-crons.js');

function main(argv = process.argv.slice(2)) {
  const check = argv.includes('--check');
  const result = syncWebCrons({ check });

  if (!result.changed) {
    console.log('apps/web/vercel.json cron config is already in sync.');
    return;
  }

  if (check) {
    console.error(
      'apps/web/vercel.json cron config is out of sync with apps/web/cron.config.json. Run `node scripts/sync-web-crons.js`.'
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    'Synced apps/web/vercel.json crons from apps/web/cron.config.json.'
  );
}

if (require.main === module) {
  main();
}

module.exports = { main };
