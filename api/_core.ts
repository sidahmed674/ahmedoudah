import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const SERVICE_LABELS: Record<string, { ar: string; fr: string; en: string }> = {
  'root-canal': { ar: 'علاج الجذور', fr: 'Traitement canalaire', en: 'Root canal' },
  ortho: { ar: 'تقويم الأسنان', fr: 'Orthodontie', en: 'Orthodontics' },
  implants: { ar: 'زراعة الأسنان', fr: 'Implants dentaires', en: 'Dental implants' },
  hollywood: { ar: 'ابتسامة هوليود', fr: 'Hollywood Smile', en: 'Hollywood Smile' },
  crowns: { ar: 'التركيبات الثابتة', fr: 'Prothèse fixe', en: 'Fixed prosthesis' },
  fillings: { ar: 'الحشوات التجميلية', fr: 'Composite esthétique', en: 'Aesthetic fillings' },
  whitening: { ar: 'تبييض بالليزر', fr: 'Blanchiment laser', en: 'Laser whitening' },
  kids: { ar: 'أسنان الأطفال', fr: 'Dents des enfants', en: 'Kids dentistry' },
  gum: { ar: 'علاج اللثة', fr: 'Gencives & détartrage', en: 'Gums & scaling' },
  surgery: { ar: 'جراحة الأسنان', fr: 'Chirurgie orale', en: 'Oral surgery' },
  sedation: { ar: 'التخدير الكلي', fr: 'Anesthésie générale', en: 'General anesthesia' },
  other: { ar: 'علاج آخر', fr: 'Autre soin', en: 'Other care' },
};

export const PERIOD_LABELS: Record<string, string> = {
  any: 'أي وقت — مستعجل / Urgent',
  morning: 'صباحاً (08:00 – 12:00)',
  evening: 'مساءً (13:00 – 17:00)',
};

export const LANG_LABELS: Record<string, string> = {
  ar: 'العربية 🇩🇿',
  fr: 'Français 🇫🇷',
  en: 'English 🇬🇧',
};

const LOGO_RELATIVE = 'public/assets/aistudio/________________________1__c4aece84.png';
const LOGO_PUBLIC_PATH = '/assets/aistudio/________________________1__c4aece84.png';

let cachedLogoBuffer: Buffer | null = null;

export function getLocalLogoBuffer(): Buffer | null {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  const candidate = path.resolve(process.cwd(), LOGO_RELATIVE);
  try {
    if (fs.existsSync(candidate)) {
      cachedLogoBuffer = fs.readFileSync(candidate);
      return cachedLogoBuffer;
    }
  } catch {
    // Ignore unreadable path
  }
  return null;
}

export async function resolveLogoBuffer(baseUrl?: string): Promise<Buffer | null> {
  const local = getLocalLogoBuffer();
  if (local) return local;
  if (!baseUrl) return null;
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}${LOGO_PUBLIC_PATH}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    cachedLogoBuffer = Buffer.from(arr);
    return cachedLogoBuffer;
  } catch {
    return null;
  }
}

export const bookedSlots = new Map<string, Set<string>>();

export function pruneOldSlots() {
  const today = new Date().toISOString().slice(0, 10);
  for (const dateKey of bookedSlots.keys()) {
    if (dateKey < today) bookedSlots.delete(dateKey);
  }
  if (bookedSlots.size > 400) {
    const keys = Array.from(bookedSlots.keys()).sort();
    for (const k of keys.slice(0, keys.length - 400)) {
      bookedSlots.delete(k);
    }
  }
}

export function isValidDZPhone(raw: string): boolean {
  const p = raw.replace(/[\s-]/g, '');
  return /^0(5|6|7)\d{8}$/.test(p);
}

export function makeRefId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${time}${rand}`;
}

export function toWhatsAppIntl(dzPhone: string): string {
  const digits = dzPhone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `213${digits.slice(1)}`;
  if (digits.startsWith('213')) return digits;
  return `213${digits}`;
}

export function formatArabicDate(ymd: string): string {
  try {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString('ar-DZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return ymd;
  }
}

export function buildBookingDiscordPayload(
  input: {
    refId: string;
    name: string;
    phone: string;
    service: string;
    date: string;
    time: string;
    notes?: string;
    lang?: string;
  },
  logoAttached = Boolean(getLocalLogoBuffer())
) {
  const svc = SERVICE_LABELS[input.service] ?? { ar: input.service, fr: input.service, en: input.service };
  const waNumber = toWhatsAppIntl(input.phone);
  const waConfirmText = encodeURIComponent(
    `سلام ${input.name} 🌸 عيادة الدكتور أحمد وضاح تذكرك: تم استلام طلب موعدك (${svc.ar}) يوم ${input.date} على الساعة ${input.time}. سيدي بلعباس 📍`
  );
  const waUrl = `https://wa.me/${waNumber}?text=${waConfirmText}`;
  const cleanNotes = input.notes?.trim() ? input.notes.trim().slice(0, 500) : '';
  const langLabel = LANG_LABELS[input.lang || 'ar'] ?? 'العربية 🇩🇿';
  const prettyDate = formatArabicDate(input.date);

  return {
    username: 'عيادة الدكتور أحمد وضاح',
    embeds: [
      {
        color: 0x253f31,
        author: {
          name: 'عيادة الدكتور أحمد وضاح • نظام المواعيد',
          ...(logoAttached ? { icon_url: 'attachment://doctor-logo.png' } : {}),
        },
        title: '🦷  طلب حجز موعد جديد',
        description: [
          `🟢 **حجز جديد**  •  🆔 \`${input.refId}\`  •  🌐 ${langLabel}`,
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ].join('\n'),
        ...(logoAttached ? { thumbnail: { url: 'attachment://doctor-logo.png' } } : {}),
        fields: [
          { name: '👤 المريض', value: `**${input.name}**`, inline: true },
          { name: '📞 رقم الهاتف', value: `\`${input.phone}\``, inline: true },
          { name: '💳 الدفع', value: 'في العيادة *(حجز مجاني)*', inline: true },
          { name: '🩺 نوع العلاج', value: `**${svc.ar}**\n*${svc.fr}*`, inline: true },
          { name: '📅 التاريخ المطلوب', value: `**${prettyDate}**\n\`${input.date}\``, inline: true },
          { name: '⏰ التوقيت', value: `\`${input.time}\``, inline: true },
          {
            name: '📝 ملاحظات المريض',
            value: cleanNotes ? `> ${cleanNotes.replace(/\n/g, '\n> ')}` : '*لا توجد ملاحظات إضافية*',
            inline: false,
          },
          {
            name: '⚡ إجراء سريع',
            value: `🔗 **[تأكيد الموعد عبر واتساب مباشرة](${waUrl})**`,
            inline: false,
          },
        ],
        footer: {
          text: 'عيادة الدكتور أحمد وضاح • سيدي بلعباس',
          ...(logoAttached ? { icon_url: 'attachment://doctor-logo.png' } : {}),
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function buildWaitingDiscordPayload(
  input: {
    refId: string;
    full_name: string;
    phone: string;
    period: string;
    lang?: string;
  },
  logoAttached = Boolean(getLocalLogoBuffer())
) {
  const periodLabel = PERIOD_LABELS[input.period] ?? PERIOD_LABELS.any;
  const waNumber = toWhatsAppIntl(input.phone);
  const waText = encodeURIComponent(
    `سلام ${input.full_name} 🌸 خبر سار من عيادة الدكتور أحمد وضاح: تحرر موعد في الفترة (${periodLabel}). تواصل معنا لتثبيت الموعد.`
  );
  const waUrl = `https://wa.me/${waNumber}?text=${waText}`;
  const langLabel = LANG_LABELS[input.lang || 'ar'] ?? 'العربية 🇩🇿';

  return {
    username: 'عيادة الدكتور أحمد وضاح',
    embeds: [
      {
        color: 0xd3c49d,
        author: {
          name: 'عيادة الدكتور أحمد وضاح • قائمة الانتظار',
          ...(logoAttached ? { icon_url: 'attachment://doctor-logo.png' } : {}),
        },
        title: '🔔  طلب انضمام لقائمة الانتظار',
        description: [
          `🟡 **انتظار شاغر**  •  🆔 \`${input.refId}\`  •  🌐 ${langLabel}`,
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ].join('\n'),
        ...(logoAttached ? { thumbnail: { url: 'attachment://doctor-logo.png' } } : {}),
        fields: [
          { name: '👤 المريض', value: `**${input.full_name}**`, inline: true },
          { name: '📞 رقم الهاتف', value: `\`${input.phone}\``, inline: true },
          { name: '🕒 الفترة المفضلة', value: `**${periodLabel}**`, inline: true },
          {
            name: '⚡ إجراء سريع',
            value: `🔗 **[إشعار المريض بتحرر موعد عبر واتساب](${waUrl})**`,
            inline: false,
          },
        ],
        footer: {
          text: 'عيادة الدكتور أحمد وضاح • سيدي بلعباس',
          ...(logoAttached ? { icon_url: 'attachment://doctor-logo.png' } : {}),
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export async function sendToDiscordOnce(
  payload: Record<string, unknown>,
  baseUrl?: string
): Promise<{ ok: boolean; retryAfterMs?: number; fatal?: boolean; status?: number }> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn('[discord] DISCORD_WEBHOOK_URL is not configured');
    return { ok: false, fatal: true, status: 0 };
  }

  const logoBuf = await resolveLogoBuffer(baseUrl);
  let res: globalThis.Response;
  if (logoBuf) {
    const form = new FormData();
    form.append('payload_json', JSON.stringify(payload));
    const blob = new Blob([new Uint8Array(logoBuf)], { type: 'image/png' });
    form.append('files[0]', blob, 'doctor-logo.png');
    res = await fetch(webhookUrl, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      const strippedJson = JSON.stringify(payload).replace(/"icon_url":"attachment:\/\/doctor-logo\.png",?/g, '').replace(/"thumbnail":\{"url":"attachment:\/\/doctor-logo\.png"\},?/g, '');
      res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: strippedJson,
        signal: AbortSignal.timeout(10_000),
      });
    }
  } else {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  }

  if (res.status === 429) {
    let retryAfterMs = 2000;
    try {
      const body = (await res.json()) as { retry_after?: number };
      if (typeof body.retry_after === 'number') {
        retryAfterMs = Math.max(500, Math.ceil(body.retry_after * 1000));
      }
    } catch {
      const hdr = Number(res.headers.get('retry-after'));
      if (!Number.isNaN(hdr) && hdr > 0) retryAfterMs = hdr * 1000;
    }
    return { ok: false, retryAfterMs, status: 429 };
  }

  if (res.ok) {
    return { ok: true, status: res.status };
  }

  const errText = await res.text().catch(() => '');
  console.error(`[discord] Webhook error ${res.status}:`, errText.slice(0, 300));
  return { ok: false, fatal: res.status >= 400 && res.status < 500 && res.status !== 429, status: res.status };
}

export async function deliverDiscordDirect(
  payload: Record<string, unknown>,
  baseUrl?: string
): Promise<{ ok: boolean; status?: number }> {
  let lastStatus: number | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await sendToDiscordOnce(payload, baseUrl);
      lastStatus = result.status;
      if (result.ok) return { ok: true, status: result.status };
      if (result.fatal || attempt === 2) return { ok: false, status: lastStatus };
      const waitMs = Math.min(3500, result.retryAfterMs ?? 750 * (attempt + 1));
      await new Promise((r) => setTimeout(r, waitMs));
    } catch (err) {
      console.error('[discord] Delivery exception:', err);
      if (attempt === 2) return { ok: false, status: lastStatus };
      await new Promise((r) => setTimeout(r, 750 * (attempt + 1)));
    }
  }
  return { ok: false, status: lastStatus };
}

interface AiCacheEntry {
  answer: string;
  expiresAt: number;
}
const aiCache = new Map<string, AiCacheEntry>();
const AI_CACHE_TTL_MS = 1000 * 60 * 30;

const SYSTEM_PROMPT = `أنت مساعد ذكي متطور وشامل مثل ChatGPT وGemini، ومخصّص أيضاً لخدمة زوار عيادة الدكتور أحمد وضاح لطب وجراحة الأسنان في سيدي بلعباس، الجزائر (Dr Ahmed Ouadah Dental Clinic).

مبادئ الإجابة الأساسية:
1. أجب على أي سؤال يطرحه المستخدم في أي مجال كان (أسنان، صحة، علوم، ثقافة عامة، تاريخ، تقنية، برمجة، تعليم، ترجمة، نصائح يومية...) بإجابات ذكية، واضحة، ومفيدة مثل ChatGPT وGemini تماماً. لا ترفض أي سؤال عام أبداً بحجة أنك مساعد عيادة فقط.
2. عندما يكون السؤال عن طب الأسنان أو عن العيادة (المواعيد، الأسعار، العنوان، الخبرة، طرق الدفع، الخدمات)، اعتمد على معلومات العيادة الدقيقة أدناه ووجّه المريض بلطف للحجز في قسم الحجز بالموقع (#reservation) أو الاتصال بالعيادة.
3. طابق لغة المستخدم وأسلوبه: بالعربية أو الدارجة الجزائرية إذا كتب بالعربية، بالفرنسية إذا كتب بالفرنسية، وبالإنجليزية إذا كتب بالإنجليزية.
4. أجب بشكل واضح ومنظّم ومباشر، واستخدم تنسيقاً بسيطاً عند الحاجة (نقاط قصيرة أو عناوين خفيفة) بدون وسوم HTML.

معلومات عيادة الدكتور أحمد وضاح (عند السؤال عنها):
- الموقع: سيدي بلعباس، الجزائر (https://maps.app.goo.gl/zTKF3dsUTG6SaYhj6)
- الهاتف والواتساب: +213 553 25 96 07 (0553 25 96 07)
- أوقات العمل: الأحد إلى الخميس من 08:00 صباحاً إلى 17:00 مساءً (استراحة الغداء 12:00 – 13:00). مغلق يومي الجمعة والسبت.
- الخبرة: خبرة تفوق 30 سنة، والعيادة الأعلى تقييماً في سيدي بلعباس بـ 4.9 من أصل آلاف المرضى.
- الخدمات: زراعة الأسنان، تقويم الأسنان (تقليدي وشفاف)، ابتسامة هوليود (الفينير)، تبييض الأسنان بالليزر، علاج الجذور بدون ألم في جلسة واحدة، التركيبات الثابتة (زيركون وسيراميك)، الحشوات التجميلية، طب أسنان الأطفال، علاج اللثة وتنظيف الجير، جراحة الأسنان وخلع ضرس العقل، التخدير الكلي للحالات الخاصة أو القلقة.
- الأسعار التقريبية (بالدينار الجزائري):
  • التنظيف وإزالة الجير / الحشوات: ابتداءً من 3,000 دج
  • التبييض بالليزر: 12,000 – 20,000 دج
  • تاج الزيركون / السيراميك: 12,000 – 25,000 دج
  • زراعة الأسنان: 45,000 – 70,000 دج (متوفرة بالتقسيط)
  • تقويم الأسنان: ابتداءً من 60,000 دج (بالتقسيط على مدة العلاج)
- الحجز والدفع: الحجز عبر الموقع مجاني 100%، والدفع يكون في العيادة فقط (نقداً أو CCP) مع تسهيلات تقسيط للعلاجات الكبرى. إذا لم يجد المريض وقتاً مناسباً يمكنه التسجيل في قائمة الانتظار بالموقع.`;

async function fetchSingleOpenRouterModel(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  signal: AbortSignal
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL || 'https://ouadah-dental.clinic',
      'X-Title': 'Dr Ahmed Ouadah Dental Clinic Assistant',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1000,
      temperature: 0.6,
    }),
    signal,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`${model} HTTP ${res.status}: ${errBody.slice(0, 160)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error(`${model} returned empty content`);
  }
  return text.slice(0, 2500);
}

export async function callOpenRouter(
  question: string,
  lang: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[assistant] OPENROUTER_API_KEY is not configured');
    return null;
  }

  const normalizedKey = `${lang}:${question.trim().toLowerCase()}`;
  if (history.length === 0) {
    const cached = aiCache.get(normalizedKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.answer;
    }
  }

  const configuredModel = process.env.OPENROUTER_MODEL?.trim() || 'nvidia/nemotron-3-ultra-550b-a55b:free';
  const fastFallbacks = ['google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'openrouter/free'].filter(
    (m) => m !== configuredModel
  );

  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\nUser UI language: ${lang}` },
    ...history.slice(-10).map((m) => ({
      role: m.role,
      content: m.content.slice(0, 800),
    })),
    { role: 'user', content: question.slice(0, 1200) },
  ];

  const globalController = new AbortController();
  let settled = false;
  const hardTimeout = setTimeout(() => globalController.abort(new Error('OpenRouter global timeout')), 14_000);

  try {
    const primaryAttempt = fetchSingleOpenRouterModel(
      apiKey,
      configuredModel,
      messages,
      globalController.signal
    );

    const fallbackPromise = new Promise<string>((resolve, reject) => {
      let triggered = false;
      const triggerFallbacks = () => {
        if (triggered || settled || globalController.signal.aborted) return;
        triggered = true;
        Promise.any(
          fastFallbacks.map((m) =>
            fetchSingleOpenRouterModel(apiKey, m, messages, globalController.signal)
          )
        )
          .then(resolve)
          .catch(reject);
      };

      const hedgeTimer = setTimeout(triggerFallbacks, 1800);
      primaryAttempt.catch(() => {
        clearTimeout(hedgeTimer);
        triggerFallbacks();
      });
      globalController.signal.addEventListener('abort', () => clearTimeout(hedgeTimer), { once: true });
    });

    const answer = await Promise.any([primaryAttempt, fallbackPromise]);
    settled = true;
    globalController.abort();

    if (history.length === 0) {
      if (aiCache.size > 2000) aiCache.clear();
      aiCache.set(normalizedKey, { answer, expiresAt: Date.now() + AI_CACHE_TTL_MS });
    }
    return answer;
  } catch (err) {
    console.warn('[assistant] All OpenRouter models failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    settled = true;
    clearTimeout(hardTimeout);
  }
}

export type ServerlessRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

export type ServerlessResponse = ServerResponse & {
  status?: (code: number) => ServerlessResponse;
  json?: (data: unknown) => void;
};

export function getRequestBaseUrl(req: ServerlessRequest): string | undefined {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || 'https';
  const hostStr = Array.isArray(host) ? host[0] : host;
  return hostStr ? `${proto}://${hostStr}` : undefined;
}

export async function readJsonBody(req: ServerlessRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buf.length;
    if (total > 16 * 1024) break;
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function sendJson(res: ServerlessResponse, statusCode: number, data: unknown) {
  if (typeof res.status === 'function') {
    const next = res.status(statusCode);
    if (typeof next.json === 'function') {
      next.json(data);
      return;
    }
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
