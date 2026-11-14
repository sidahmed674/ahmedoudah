import type { ServerlessRequest, ServerlessResponse } from './_core';
import { callOpenRouter, readJsonBody, sendJson } from './_core';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, answer: null });
  }

  const body = await readJsonBody(req);
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const lang = typeof body.lang === 'string' ? body.lang.trim() : 'ar';
  const history = Array.isArray(body.history)
    ? body.history.filter(
        (m): m is { role: 'user' | 'assistant'; content: string } =>
          Boolean(m) &&
          typeof m === 'object' &&
          ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'assistant') &&
          typeof (m as { content?: unknown }).content === 'string'
      )
    : [];

  if (!question) {
    return sendJson(res, 400, { ok: false, answer: null });
  }

  const answer = await callOpenRouter(question, lang, history);
  return sendJson(res, 200, { ok: Boolean(answer), answer });
}
