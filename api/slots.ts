import type { ServerlessRequest, ServerlessResponse } from './_core';
import { bookedSlots, sendJson } from './_core';

export default function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  let date = '';
  if (req.query && typeof req.query.date === 'string') {
    date = req.query.date;
  } else if (req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      date = parsed.searchParams.get('date') || '';
    } catch {
      date = '';
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return sendJson(res, 200, { times: [] });
  }
  res.setHeader('Cache-Control', 'public, max-age=5');
  const set = bookedSlots.get(date);
  return sendJson(res, 200, { times: set ? Array.from(set) : [] });
}
