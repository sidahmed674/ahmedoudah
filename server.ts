import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import {
  PERIOD_LABELS,
  SERVICE_LABELS,
  bookedSlots,
  buildBookingDiscordPayload,
  buildWaitingDiscordPayload,
  callOpenRouter,
  isValidDZPhone,
  makeRefId,
  pruneOldSlots,
  sendToDiscordOnce,
} from './api/_core.ts';

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
