import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import compression from 'compression';

try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch {
  // Ignore missing/unreadable .env
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

function resolvePort(): number {
  const portFlagIdx = process.argv.indexOf('--port');
  if (portFlagIdx !== -1 && process.argv[portFlagIdx + 1]) {
    const cliPort = Number(process.argv[portFlagIdx + 1]);
    if (!Number.isNaN(cliPort) && cliPort > 0) return cliPort;
  }
  const envDefault = Number(process.env.DEFAULT_APP_PORT);
  if (!Number.isNaN(envDefault) && envDefault > 0) return envDefault;
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  if (!Number.isNaN(envPort) && envPort > 0 && envPort !== nginxPort) {
    return envPort;
  }
  return 3000;
}

const PORT = resolvePort();

const SERVICE_LABELS: Record<string, { ar: string; fr: string; en: string }> = {
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

const PERIOD_LABELS: Record<string, string> = {
  any: 'أي وقت — مستعجل / Urgent',
  morning: 'صباحاً (08:00 – 12:00)',
  evening: 'مساءً (13:00 – 17:00)',
};

const LANG_LABELS: Record<string, string> = {
  ar: 'العربية 🇩🇿',
  fr: 'Français 🇫🇷',
  en: 'English 🇬🇧',
};

const LOGO_PATH = path.resolve(__dirname, 'public/assets/aistudio/________________________1__c4aece84.png');
function getLogoBuffer(): Buffer | null {
  try {
    if (fs.existsSync(LOGO_PATH)) {
      return fs.readFileSync(LOGO_PATH);
    }
  } catch {
    // Ignore
  }
  return null;
}

const bookedSlots = new Map<string, Set<string>>();

function pruneOldSlots() {
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

interface RateBucket {
  count: number;
  resetAt: number;
}
const rateBuckets = new Map<string, RateBucket>();

function rateLimit(keyPrefix: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').slice(0, 64);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const existing = rateBuckets.get(key);

    if (!existing || now > existing.resetAt) {
      if (rateBuckets.size > 50_000) {
        for (const [k, v] of rateBuckets) {
          if (now > v.resetAt) rateBuckets.delete(k);
          if (rateBuckets.size <= 35_000) break;
        }
      }
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= maxRequests) {
      res.setHeader('Retry-After', String(Math.ceil((existing.resetAt - now) / 1000)));
      return res.status(429).json({ ok: false, error: 'too_many_requests' });
    }

    existing.count += 1;
    return next();
  };
}

interface DiscordTask {
  payload: Record<string, unknown>;
  attempt: number;
  resolve: (delivered: boolean) => void;
}

const discordQueue: DiscordTask[] = [];
const MAX_DISCORD_QUEUE = 5000;
let discordWorkerRunning = false;

async function sendToDiscordOnce(payload: Record<string, unknown>): Promise<{ ok: boolean; retryAfterMs?: number; fatal?: boolean }> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn('[discord] DISCORD_WEBHOOK_URL is not configured in .env');
    return { ok: false, fatal: true };
  }

  const logoBuf = getLogoBuffer();
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
    return { ok: false, retryAfterMs };
  }

  if (res.ok) {
    const remaining = Number(res.headers.get('x-ratelimit-remaining'));
    const resetAfter = Number(res.headers.get('x-ratelimit-reset-after'));
    if (remaining === 0 && !Number.isNaN(resetAfter) && resetAfter > 0) {
      await new Promise((r) => setTimeout(r, Math.ceil(resetAfter * 1000)));
    }
    return { ok: true };
  }

  const errText = await res.text().catch(() => '');
  console.error(`[discord] Webhook error ${res.status}:`, errText.slice(0, 300));
  return { ok: false, fatal: res.status >= 400 && res.status < 500 && res.status !== 429 };
}

async function runDiscordWorker() {
  if (discordWorkerRunning) return;
  discordWorkerRunning = true;
  try {
    while (discordQueue.length > 0) {
      const task = discordQueue.shift()!;
      try {
        const result = await sendToDiscordOnce(task.payload);
        if (result.ok) {
          task.resolve(true);
        } else if (result.fatal || task.attempt >= 4) {
          task.resolve(false);
        } else {
          const waitMs = result.retryAfterMs ?? Math.min(8000, 750 * 2 ** task.attempt);
          await new Promise((r) => setTimeout(r, waitMs));
          discordQueue.unshift({ ...task, attempt: task.attempt + 1 });
        }
      } catch (err) {
        console.error('[discord] Delivery exception:', err);
        if (task.attempt >= 4) {
          task.resolve(false);
        } else {
          await new Promise((r) => setTimeout(r, 1000 * (task.attempt + 1)));
          discordQueue.unshift({ ...task, attempt: task.attempt + 1 });
        }
      }
    }
  } finally {
    discordWorkerRunning = false;
  }
}

function enqueueDiscord(payload: Record<string, unknown>, waitUpToMs = 3500): Promise<boolean> {
  if (!process.env.DISCORD_WEBHOOK_URL?.trim()) {
    return Promise.resolve(false);
  }
  if (discordQueue.length >= MAX_DISCORD_QUEUE) {
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(true);
      }
    }, waitUpToMs);

    discordQueue.push({
      payload,
      attempt: 0,
      resolve: (ok) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(ok);
        }
      },
    });
    void runDiscordWorker();
  });
}

function toWhatsAppIntl(dzPhone: string): string {
  const digits = dzPhone.replace(/\D/g, '');
  if (digits.startsWith('0')) return `213${digits.slice(1)}`;
  if (digits.startsWith('213')) return digits;
  return `213${digits}`;
}

function formatArabicDate(ymd: string): string {
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

function buildBookingDiscordPayload(input: {
  refId: string;
  name: string;
  phone: string;
  service: string;
  date: string;
  time: string;
  notes?: string;
  lang?: string;
}) {
  const svc = SERVICE_LABELS[input.service] ?? { ar: input.service, fr: input.service, en: input.service };
  const waNumber = toWhatsAppIntl(input.phone);
  const waConfirmText = encodeURIComponent(
    `سلام ${input.name} 🌸 عيادة الدكتور أحمد وضاح تذكرك: تم استلام طلب موعدك (${svc.ar}) يوم ${input.date} على الساعة ${input.time}. سيدي بلعباس 📍`
  );
  const waUrl = `https://wa.me/${waNumber}?text=${waConfirmText}`;
  const cleanNotes = input.notes?.trim() ? input.notes.trim().slice(0, 500) : '';
  const langLabel = LANG_LABELS[input.lang || 'ar'] ?? 'العربية 🇩🇿';
  const prettyDate = formatArabicDate(input.date);
  const logoAttached = Boolean(getLogoBuffer());

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

function buildWaitingDiscordPayload(input: {
  refId: string;
  full_name: string;
  phone: string;
  period: string;
  lang?: string;
}) {
  const periodLabel = PERIOD_LABELS[input.period] ?? PERIOD_LABELS.any;
  const waNumber = toWhatsAppIntl(input.phone);
  const waText = encodeURIComponent(
    `سلام ${input.full_name} 🌸 خبر سار من عيادة الدكتور أحمد وضاح: تحرر موعد في الفترة (${periodLabel}). تواصل معنا لتثبيت الموعد.`
  );
  const waUrl = `https://wa.me/${waNumber}?text=${waText}`;
  const langLabel = LANG_LABELS[input.lang || 'ar'] ?? 'العربية 🇩🇿';
  const logoAttached = Boolean(getLogoBuffer());

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

async function callOpenRouter(
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

function isValidDZPhone(raw: string): boolean {
  const p = raw.replace(/[\s-]/g, '');
  return /^0(5|6|7)\d{8}$/.test(p);
}

function makeRefId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${time}${rand}`;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(compression());
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      discordConfigured: Boolean(process.env.DISCORD_WEBHOOK_URL?.trim()),
      openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
      queueDepth: discordQueue.length,
    });
  });

  app.get('/api/slots', rateLimit('slots', 120, 60_000), (req, res) => {
    const date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.json({ times: [] });
    }
    res.setHeader('Cache-Control', 'public, max-age=5');
    const set = bookedSlots.get(date);
    return res.json({ times: set ? Array.from(set) : [] });
  });

  app.post('/api/bookings', rateLimit('bookings', 10, 60_000), async (req, res) => {
    const body = req.body as {
      name?: unknown;
      phone?: unknown;
      service?: unknown;
      date?: unknown;
      time?: unknown;
      notes?: unknown;
      lang?: unknown;
    };

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const rawPhone = typeof body.phone === 'string' ? body.phone.replace(/[\s-]/g, '') : '';
    const service = typeof body.service === 'string' ? body.service.trim() : '';
    const date = typeof body.date === 'string' ? body.date.trim() : '';
    const time = typeof body.time === 'string' ? body.time.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;
    const lang = typeof body.lang === 'string' ? body.lang.trim() : 'ar';

    if (!name || name.length > 100 || !isValidDZPhone(rawPhone) || !SERVICE_LABELS[service]) {
      return res.status(400).json({ ok: false, reason: 'error' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ ok: false, reason: 'error' });
    }

    pruneOldSlots();
    let daySet = bookedSlots.get(date);
    if (!daySet) {
      daySet = new Set<string>();
      bookedSlots.set(date, daySet);
    }
    if (daySet.has(time)) {
      return res.status(409).json({ ok: false, reason: 'taken' });
    }

    daySet.add(time);

    const refId = makeRefId('RDV');
    const payload = buildBookingDiscordPayload({
      refId,
      name,
      phone: rawPhone,
      service,
      date,
      time,
      notes,
      lang,
    });

    await enqueueDiscord(payload);
    return res.json({ ok: true, refId });
  });

  app.post('/api/waiting', rateLimit('waiting', 10, 60_000), async (req, res) => {
    const body = req.body as {
      full_name?: unknown;
      phone?: unknown;
      period?: unknown;
      lang?: unknown;
    };

    const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const rawPhone = typeof body.phone === 'string' ? body.phone.replace(/[\s-]/g, '') : '';
    const period = typeof body.period === 'string' && PERIOD_LABELS[body.period] ? body.period : 'any';
    const lang = typeof body.lang === 'string' ? body.lang.trim() : 'ar';

    if (!full_name || full_name.length > 100 || !isValidDZPhone(rawPhone)) {
      return res.status(400).json({ ok: false });
    }

    const refId = makeRefId('WAIT');
    const payload = buildWaitingDiscordPayload({
      refId,
      full_name,
      phone: rawPhone,
      period,
      lang,
    });

    await enqueueDiscord(payload);
    return res.json({ ok: true, refId });
  });

  app.post('/api/assistant', rateLimit('assistant', 30, 60_000), async (req, res) => {
    const body = req.body as {
      question?: unknown;
      lang?: unknown;
      history?: unknown;
    };

    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const lang = typeof body.lang === 'string' ? body.lang.trim() : 'ar';
    const history = Array.isArray(body.history)
      ? body.history.filter(
          (m): m is { role: 'user' | 'assistant'; content: string } =>
            Boolean(m) &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string'
        )
      : [];

    if (!question) {
      return res.status(400).json({ ok: false, answer: null });
    }

    const answer = await callOpenRouter(question, lang, history);
    return res.json({ ok: Boolean(answer), answer });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(
      express.static(distDir, {
        maxAge: '1h',
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[clinic-server] Listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('[clinic-server] Fatal startup error:', err);
  process.exit(1);
});
