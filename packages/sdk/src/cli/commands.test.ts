import { afterEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../package.json';
import {
  getTaskClosePayload,
  getTaskDonePayload,
  getTaskUpdatePayload,
  runCli,
} from './commands';

describe('CLI commands', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(['-v', '--version'])('prints version for %s', async (flag) => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await runCli([flag]);

    expect(write).toHaveBeenCalledWith(`${packageJson.version}\n`);
  });

  it.each([
    ['--help'],
    ['-h'],
    ['help'],
  ])('prints global help for %s', async (...args) => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await runCli(args);

    expect(write).toHaveBeenCalledWith(expect.stringContaining('Scoped help:'));
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('ttr tasks --help')
    );
    expect(write).toHaveBeenCalledWith(expect.stringContaining('  upgrade'));
  });

  it.each([
    ['upgrade', '--help'],
    ['help', 'upgrade'],
  ])('prints scoped upgrade help for %s', async (...args) => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await runCli(args);

    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Usage: ttr upgrade')
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Upgrades the globally installed Tuturuuu CLI')
    );
  });

  it.each([
    ['tasks', '--help'],
    ['help', 'tasks'],
    ['tasks', 'help'],
  ])('prints scoped group help for %s', async (...args) => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await runCli(args);

    expect(write).toHaveBeenCalledWith(
      expect.stringContaining(
        'Usage: ttr tasks [list|use|get|create|update|delete|move|bulk]'
      )
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Task lists are sorted by priority and due date.')
    );
  });

  it.each([
    ['tasks', 'create', '--help'],
    ['help', 'tasks', 'create'],
    ['tasks', 'help', 'create'],
  ])('prints scoped action help for %s', async (...args) => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await runCli(args);

    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Usage: ttr tasks create [name] [options]')
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('ttr tasks create "Add Tuturuuu CLI"')
    );
  });

  it.each([
    ['tasks', 'done', '--help'],
    ['tasks', 'complete', '--help'],
    ['help', 'tasks', 'done'],
    ['tasks', 'help', 'done'],
  ])('prints scoped done help for %s', async (...args) => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await runCli(args);

    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Usage: ttr tasks done [task-id] [options]')
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('ttr tasks done <task-id>')
    );
  });

  it.each([
    ['tasks', 'close', '--help'],
    ['tasks', 'closed', '--help'],
    ['help', 'tasks', 'close'],
    ['tasks', 'help', 'close'],
  ])('prints scoped close help for %s', async (...args) => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    await runCli(args);

    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Usage: ttr tasks close [task-id] [options]')
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('ttr tasks close <task-id>')
    );
  });

  it('adds completed_at when marking a task completed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T17:59:08.000Z'));

    expect(
      getTaskUpdatePayload({
        'json-payload': JSON.stringify({ completed: true }),
      })
    ).toEqual({
      completed: true,
      completed_at: '2026-05-02T17:59:08.000Z',
    });
  });

  it('keeps explicit done destinations when marking a task completed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T17:59:08.000Z'));

    expect(
      getTaskUpdatePayload({
        'json-payload': JSON.stringify({ completed: true }),
        list: 'done-list-1',
      })
    ).toEqual({
      completed: true,
      completed_at: '2026-05-02T17:59:08.000Z',
      list_id: 'done-list-1',
    });
  });

  it('does not override explicit completion timestamps', () => {
    expect(
      getTaskUpdatePayload({
        'json-payload': JSON.stringify({
          completed: true,
          completed_at: '2026-05-01T00:00:00.000Z',
        }),
      })
    ).toEqual({
      completed: true,
      completed_at: '2026-05-01T00:00:00.000Z',
    });
  });

  it('builds quick done payloads with an optional done list', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T17:59:08.000Z'));

    expect(getTaskDonePayload({}, 'done-list-1')).toEqual({
      completed: true,
      completed_at: '2026-05-02T17:59:08.000Z',
      list_id: 'done-list-1',
    });
  });

  it('builds quick close payloads with an optional closed list', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T17:59:08.000Z'));

    expect(getTaskClosePayload({}, 'closed-list-1')).toEqual({
      closed_at: '2026-05-02T17:59:08.000Z',
      completed: false,
      completed_at: null,
      list_id: 'closed-list-1',
    });
  });
});
