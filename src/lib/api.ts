import type { Language } from '../translations';

export async function getBookedTimes(dateYMD: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/slots?date=${encodeURIComponent(dateYMD)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { times?: string[] };
    return Array.isArray(data.times) ? data.times : [];
  } catch {
    return [];
  }
}

export async function createBooking(input: {
  name: string;
  phone: string;
  service: string;
  date: string;
  time: string;
  notes?: string;
  lang?: Language;
}): Promise<{ ok: boolean; reason?: 'taken' | 'error'; refId?: string; detail?: string }> {
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      reason?: 'taken' | 'error';
      refId?: string;
      code?: string;
    };
    if (!res.ok || !data.ok) {
      if (data.reason === 'taken') {
        return { ok: false, reason: 'taken' };
      }
      const detail = data.code || `HTTP_${res.status}`;
      return { ok: false, reason: 'error', detail };
    }
    return { ok: true, refId: data.refId };
  } catch {
    return { ok: false, reason: 'error', detail: 'NETWORK_ERROR' };
  }
}

export async function joinWaiting(input: {
  full_name: string;
  phone: string;
  period: 'any' | 'morning' | 'evening';
  lang?: Language;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/waiting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

export async function askClinicAssistant(input: {
  question: string;
  lang: Language;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string | null> {
  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { answer?: string | null };
    return typeof data.answer === 'string' && data.answer.trim() ? data.answer : null;
  } catch {
    return null;
  }
}
