import type { ServerlessRequest, ServerlessResponse } from './_core';
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
} from './_core';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false });
  }

  const body = await readJsonBody(req);
  const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const rawPhone = typeof body.phone === 'string' ? body.phone.replace(/[\s-]/g, '') : '';
  const period = typeof body.period === 'string' && PERIOD_LABELS[body.period] ? body.period : 'any';
  const lang = typeof body.lang === 'string' ? body.lang.trim() : 'ar';

  if (!full_name || full_name.length > 100 || !isValidDZPhone(rawPhone)) {
    return sendJson(res, 400, { ok: false });
  }

  if (!process.env.DISCORD_WEBHOOK_URL?.trim()) {
    console.error('[waiting] DISCORD_WEBHOOK_URL is missing in environment variables');
    return sendJson(res, 503, { ok: false });
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

  const delivered = await deliverDiscordDirect(payload, baseUrl);
  if (!delivered) {
    return sendJson(res, 502, { ok: false });
  }

  return sendJson(res, 200, { ok: true, refId });
}
