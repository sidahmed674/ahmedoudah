import type { ServerlessRequest, ServerlessResponse } from './_core.js';
import { sendJson } from './_core.js';

export default function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  return sendJson(res, 200, {
    ok: true,
    discordConfigured: Boolean(process.env.DISCORD_WEBHOOK_URL?.trim()),
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    runtime: 'vercel-serverless',
  });
}
