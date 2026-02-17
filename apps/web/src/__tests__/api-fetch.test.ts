import { describe, expect, it, vi } from 'vitest';
import { apiFetch, HttpError, isRateLimitError } from '../lib/api-fetch';

describe('HttpError', () => {
  it('should create an error with status and message', () => {
    const error = new HttpError(404, 'Not Found');
    expect(error.status).toBe(404);
    expect(error.message).toBe('Not Found');
    expect(error.name).toBe('HttpError');
    expect(error.retryAfter).toBeUndefined();
  });

  it('should include retryAfter when provided', () => {
    const error = new HttpError(429, 'Rate limited', 30);
    expect(error.status).toBe(429);
    expect(error.retryAfter).toBe(30);
  });

  it('should be an instance of Error', () => {
    const error = new HttpError(500, 'Server error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
  });
});

describe('isRateLimitError', () => {
  it('should return true for 429 HttpError', () => {
    const error = new HttpError(429, 'Rate limited', 5);
    expect(isRateLimitError(error)).toBe(true);
  });

  it('should return false for non-429 HttpError', () => {
    expect(isRateLimitError(new HttpError(500, 'Server error'))).toBe(false);
    expect(isRateLimitError(new HttpError(401, 'Unauthorized'))).toBe(false);
    expect(isRateLimitError(new HttpError(403, 'Forbidden'))).toBe(false);
  });

  it('should return false for plain Error', () => {
    expect(isRateLimitError(new Error('something'))).toBe(false);
  });

  it('should return false for non-Error values', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError('string error')).toBe(false);
    expect(isRateLimitError(429)).toBe(false);
    expect(isRateLimitError({ status: 429 })).toBe(false);
  });
});

describe('apiFetch', () => {
  it('should return JSON data on success', async () => {
    const mockData = { items: [1, 2, 3] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await apiFetch<{ items: number[] }>('/api/test');
    expect(result).toEqual(mockData);
  });

  it('should throw HttpError on non-2xx response with JSON body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(apiFetch('/api/missing')).rejects.toThrow(HttpError);
    try {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
      );
      await apiFetch('/api/missing');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(404);
      expect((e as HttpError).message).toBe('Not found');
    }
  });

  it('should throw HttpError with retryAfter on 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Retry-After': '15' },
      })
    );

    try {
      await apiFetch('/api/rate-limited');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(429);
      expect((e as HttpError).retryAfter).toBe(15);
    }
  });

  it('should default retryAfter to 5 for 429 without header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 })
    );

    try {
      await apiFetch('/api/rate-limited');
    } catch (e) {
      expect((e as HttpError).retryAfter).toBe(5);
    }
  });

  it('should fall back to statusText when JSON parsing fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('plain text error', {
        status: 500,
        statusText: 'Internal Server Error',
      })
    );

    try {
      await apiFetch('/api/broken');
    } catch (e) {
      expect((e as HttpError).status).toBe(500);
      expect((e as HttpError).message).toBe('Internal Server Error');
    }
  });

  it('should pass through request init options', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

    await apiFetch('/api/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'test' }),
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'test' }),
    });
  });
});
