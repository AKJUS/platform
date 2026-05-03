import { describe, expect, it } from 'vitest';
import { parseObservabilityFilters } from './observability';

describe('parseObservabilityFilters', () => {
  it('normalizes empty and all filters', () => {
    const filters = parseObservabilityFilters(
      new URLSearchParams({
        level: 'all',
        page: '0',
        pageSize: '999',
        source: 'all',
        timeframeHours: '-1',
      })
    );

    expect(filters).toMatchObject({
      level: null,
      page: 1,
      pageSize: 200,
      source: null,
      timeframeHours: 24,
    });
  });

  it('keeps searchable log filters', () => {
    const filters = parseObservabilityFilters(
      new URLSearchParams({
        level: 'error',
        page: '3',
        pageSize: '25',
        q: 'cron failure',
        since: '1710000000000',
        source: 'cron',
        status: '5xx',
        timeframeHours: '168',
        until: '2026-05-04T01:02:03.000Z',
      })
    );

    expect(filters).toMatchObject({
      level: 'error',
      page: 3,
      pageSize: 25,
      q: 'cron failure',
      since: 1710000000000,
      source: 'cron',
      status: '5xx',
      timeframeHours: 168,
      until: Date.parse('2026-05-04T01:02:03.000Z'),
    });
  });
});
