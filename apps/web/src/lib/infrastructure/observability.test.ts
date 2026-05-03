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
        source: 'cron',
        status: '5xx',
        timeframeHours: '168',
      })
    );

    expect(filters).toMatchObject({
      level: 'error',
      page: 3,
      pageSize: 25,
      q: 'cron failure',
      source: 'cron',
      status: '5xx',
      timeframeHours: 168,
    });
  });
});
