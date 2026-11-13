import { useState } from 'react';
import { motion } from 'framer-motion';
import { BellRing, Check, Clock } from 'lucide-react';
import type { Language } from './translations';
import { validDZPhone, normalizeDZPhone } from './lib/clinic';
import { joinWaiting } from './lib/supabase';

interface Props {
  lang: Language;
  t: any;
}

export default function WaitingList({ t }: Props) {
  const w = t.waiting;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [period, setPeriod] = useState<'any' | 'morning' | 'evening'>('any');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const p = normalizeDZPhone(phone);
    if (!name.trim() || !validDZPhone(p)) {
      setError(w.badPhone);
      return;
    }
    setSending(true);
    const ok = await joinWaiting({ full_name: name.trim(), phone: p, period, service_code: 'other' });
    setSending(false);
    if (!ok) {
      setError(w.badPhone);
      return;
    }
    setDone(true);
  }

  return (
    <section className="rounded-[2rem] md:rounded-[2.5rem] bg-[#2d4638] text-white p-6 md:p-12 shadow-xl">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-8 items-center">
        <div>
          <span className="text-xs uppercase tracking-[0.24em] text-[#D3C49D]">{w.overline}</span>
          <h2 className="mt-3 text-3xl md:text-5xl font-normal tracking-tight">{w.title}</h2>
          <p className="mt-4 text-white/70 leading-relaxed max-w-md">{w.description}</p>
          <div className="mt-6 flex items-center gap-2 text-sm text-white/60">
            <Clock className="h-4 w-4" />
            <span>{w.morning} • {w.evening}</span>
          </div>
        </div>
        <div className="rounded-[1.8rem] bg-white text-[rgba(37,63,49,0.95)] p-5 md:p-7">
          {done ? (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
              <div className="mx-auto w-14 h-14 rounded-full bg-[rgba(94,135,108,0.12)] flex items-center justify-center">
                <Check className="h-7 w-7 text-[rgba(94,135,108,1)]" strokeWidth={3} />
              </div>
              <p className="mt-4 font-medium leading-relaxed">{w.joined}</p>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold">{w.name}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={w.namePh}
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-[#f8f9f8] px-4 py-3 text-sm outline-none focus:border-[rgba(94,135,108,0.6)]" />
              </div>
              <div>
                <label className="text-xs font-bold">{w.phone}</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={w.phonePh} dir="ltr" style={{ textAlign: 'left' }}
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-[#f8f9f8] px-4 py-3 text-sm outline-none focus:border-[rgba(94,135,108,0.6)]" />
              </div>
              <div>
                <label className="text-xs font-bold">{w.period}</label>
                <select value={period} onChange={(e) => setPeriod(e.target.value as any)}
                  className="mt-1 w-full rounded-2xl border border-black/10 bg-[#f8f9f8] px-4 py-3 text-sm outline-none focus:border-[rgba(94,135,108,0.6)]">
                  <option value="any">{w.any}</option>
                  <option value="morning">{w.morning}</option>
                  <option value="evening">{w.evening}</option>
                </select>
              </div>
              {error && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 text-center">{error}</p>}
              <button type="submit" disabled={sending}
                className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-[rgba(37,63,49,0.92)] text-white py-3.5 text-sm font-medium hover:bg-[rgba(37,63,49,1)] transition-colors disabled:opacity-60">
                <BellRing className="h-4 w-4" /> {sending ? '…' : w.join}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
