import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/async';

const CASINO_TIMEOUT_MS = 10_000;

export async function invokeCasino<T extends object>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const request = supabase.functions.invoke('casino', {
    body: { action, request_id: crypto.randomUUID(), ...params },
  });
  const { data, error } = await withTimeout(
    request,
    CASINO_TIMEOUT_MS,
    'Сервер казино не отвечает',
  );
  if (error) throw new Error(error.message || 'Ошибка сервера казино');
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export function casinoErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Казино временно недоступно';
}
