export class RequestTimeoutError extends Error {
  constructor(message = 'Сервер не отвечает. Попробуйте ещё раз.') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

export async function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  message?: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new RequestTimeoutError(message)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([Promise.resolve(operation), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
