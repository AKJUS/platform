export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return;
  }

  const { installConsoleLogDrain } = await import(
    './lib/infrastructure/log-drain'
  );

  installConsoleLogDrain();
}
