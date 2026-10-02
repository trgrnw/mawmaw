/** Supabase errors are often plain objects rather than Error instances. */
export function errorInfo(value: unknown): { message: string; code?: string } {
  if (value && typeof value === 'object') {
    const error = value as { message?: unknown; code?: unknown };
    return { message: typeof error.message === 'string' ? error.message : 'Не удалось выполнить действие', code: typeof error.code === 'string' ? error.code : undefined };
  }
  return { message: typeof value === 'string' ? value : 'Не удалось выполнить действие' };
}
