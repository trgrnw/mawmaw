import { supabase } from '@/integrations/supabase/client';

const CASINO_TIMEOUT_MS = 10_000;

export async function invokeCasino(
  action: string,
  params: Record<string, unknown> = {},
): Promise<any> {
  const request = supabase.functions.invoke('casino', {
    body: { action, ...params },
  });
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Сервер казино не отвечает')), CASINO_TIMEOUT_MS);
  });

  const { data, error } = await Promise.race([request, timeout]);
  if (error) throw new Error(error.message || 'Ошибка сервера казино');
  return data;
}

export function casinoErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Казино временно недоступно';
}
