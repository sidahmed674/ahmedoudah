import type { ServerlessRequest, ServerlessResponse } from './_core.js';
import {
  SERVICE_LABELS,
  bookedSlots,
  buildBookingDiscordPayload,
  deliverDiscordDirect,
  getRequestBaseUrl,
  isValidDZPhone,
  makeRefId,
  pruneOldSlots,
  readJsonBody,
  resolveLogoBuffer,
  sendJson,
} from './_core.js';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, reason: 'error', code: 'METHOD_NOT_ALLOWED' });
  }

  const body = await readJsonBody(req);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const rawPhone = typeof body.phone === 'string' ? body.phone.replace(/[\s-]/g, '') : '';
  const service = typeof body.service === 'string' ? body.service.trim() : '';
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  const time = typeof body.time === 'string' ? body.time.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;
  const lang = typeof body.lang === 'string' ? body.lang.trim() : 'ar';

  if (!name || name.length > 100 || !isValidDZPhone(rawPhone) || !SERVICE_LABELS[service]) {
    return sendJson(res, 400, { ok: false, reason: 'error', code: 'INVALID_INPUT' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return sendJson(res, 400, { ok: false, reason: 'error', code: 'INVALID_DATETIME' });
  }

  pruneOldSlots();
  let daySet = bookedSlots.get(date);
  if (!daySet) {
    daySet = new Set<string>();
    bookedSlots.set(date, daySet);
  }
  if (daySet.has(time)) {
    return sendJson(res, 409, { ok: false, reason: 'taken' });
  }

  if (!process.env.DISCORD_WEBHOOK_URL?.trim()) {
    console.error('[bookings] DISCORD_WEBHOOK_URL is missing in environment variables');
    return sendJson(res, 503, { ok: false, reason: 'error', code: 'MISSING_DISCORD_WEBHOOK' });
  }

  const baseUrl = getRequestBaseUrl(req);
  const logoBuf = await resolveLogoBuffer(baseUrl);
  const refId = makeRefId('RDV');
  const payload = buildBookingDiscordPayload(
    {
      refId,
      name,
      phone: rawPhone,
      service,
      date,
      time,
      notes,
      lang,
    },
    Boolean(logoBuf)
  );

  const delivery = await deliverDiscordDirect(payload, baseUrl);
  if (!delivery.ok) {
    return sendJson(res, 502, {
      ok: false,
      reason: 'error',
      code: `DISCORD_HTTP_${delivery.status ?? 'ERR'}`,
    });
  }

  daySet.add(time);
  return sendJson(res, 200, { ok: true, refId });
}
