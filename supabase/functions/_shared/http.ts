export class RequestLimitError extends Error {}
/** Read at most limit bytes, including chunked requests without Content-Length. */
export async function readJsonBody(request: Request, limit: number): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > limit) throw new RequestLimitError('Request too large');
  if (!request.body) throw new Error('Missing request body');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, text = '';
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new RequestLimitError('Request too large'); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  const body: unknown = JSON.parse(text);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid JSON object');
  return body as Record<string, unknown>;
}
export function validActions(actions: unknown): boolean {
  return Array.isArray(actions) && actions.length <= 200 && actions.every(action => action
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(action.id)
    && typeof action.type === 'string' && action.type.length <= 50
    && action.args && typeof action.args === 'object' && !Array.isArray(action.args));
}
