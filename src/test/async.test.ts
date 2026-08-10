import { describe, expect, it, vi } from 'vitest';
import { RequestTimeoutError, withTimeout } from '@/lib/async';

describe('withTimeout', () => {
  it('returns a completed request', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');
  });

  it('rejects a stalled request with a readable error', async () => {
    vi.useFakeTimers();
    const result = withTimeout(new Promise(() => undefined), 100, 'Сервис завис');
    const assertion = expect(result).rejects.toEqual(expect.any(RequestTimeoutError));
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    vi.useRealTimers();
  });
});
