import type { ServerlessRequest, ServerlessResponse } from './_core.js';
import {
  PERIOD_LABELS,
  buildWaitingDiscordPayload,
  deliverDiscordDirect,
  getRequestBaseUrl,
  isValidDZPhone,
  makeRefId,
  readJsonBody,
  resolveLogoBuffer,
  sendJson,
} from './_core.js';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const body = await readJsonBody(req);
  const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const rawPhone = typeof body.phone === 'string' ? body.phone.replace(/[\s-]/g, '') : '';
  const period = typeof body.period === 'string' && PERIOD_LABELS[body.period] ? body.period : 'any';
  const lang = typeof body.lang === 'string' ? body.lang.trim() : 'ar';

  if (!full_name || full_name.length > 100 || !isValidDZPhone(rawPhone)) {
    return sendJson(res, 400, { ok: false, code: 'INVALID_INPUT' });
  }

  if (!process.env.DISCORD_WEBHOOK_URL?.trim()) {
    console.error('[waiting] DISCORD_WEBHOOK_URL is missing in environment variables');
    return sendJson(res, 503, { ok: false, code: 'MISSING_DISCORD_WEBHOOK' });
  }

  const baseUrl = getRequestBaseUrl(req);
  const logoBuf = await resolveLogoBuffer(baseUrl);
  const refId = makeRefId('WAIT');
  const payload = buildWaitingDiscordPayload(
    {
      refId,
      full_name,
      phone: rawPhone,
      period,
      lang,
    },
    Boolean(logoBuf)
  );

  const delivery = await deliverDiscordDirect(payload, baseUrl);
  if (!delivery.ok) {
    return sendJson(res, 502, {
      ok: false,
      code: `DISCORD_HTTP_${delivery.status ?? 'ERR'}`,
    });
  }

  return sendJson(res, 200, { ok: true, refId });
}
