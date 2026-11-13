import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { adminT, type AdminLang } from '../adminI18n';
import { adminListWaiting, adminSetWaitingStatus, type WaitingEntry } from '../../lib/supabase';
import { Card, svcLabel } from '../ui';

export default function Waiting({ lang }: { lang: AdminLang }) {
  const t = adminT[lang];
  const [list, setList] = useState<WaitingEntry[]>([]);

  async function load() {
    setList(await adminListWaiting());
  }
  useEffect(() => { load(); }, []);

  const active = list.filter((w) => w.status === 'waiting' || w.status === 'notified');

  function notifyHref(w: WaitingEntry): string {
    const msg = `سلام ${w.full_name} 🌸 عيادة الدكتور أحمد وضاح: تحرر موعد (${svcLabel(w.service_code, lang)}) يناسب فترتك (${t[`period_${w.period}` as 'period_any' | 'period_morning' | 'period_evening']}). رد بسرعة للحجز.`;
    return `https://wa.me/213${w.phone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`;
  }

  async function setStatus(w: WaitingEntry, s: WaitingEntry['status']) {
    await adminSetWaitingStatus(w.id, s);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">{t.menu.waiting} ({active.length})</h1>
      <Card className="mt-4 overflow-hidden">
        <div className="divide-y divide-black/5">
          {active.map((w, i) => (
            <div key={w.id} className="px-4 py-3 flex items-center gap-3 text-sm">
              <span className={`w-7 h-7 rounded-lg text-center font-bold leading-7 shrink-0 ${i === 0 ? 'bg-[#D3C49D] text-[#253F31]' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{w.full_name} <span className="font-normal text-slate-400" dir="ltr">{w.phone}</span></div>
                <div className="text-xs text-slate-500">
                  {t[`period_${w.period}` as 'period_any' | 'period_morning' | 'period_evening']} • {svcLabel(w.service_code, lang)}
                  {w.status === 'notified' && <b className="text-emerald-600"> • ✓</b>}
                </div>
              </div>
              <a target="_blank" rel="noreferrer" href={notifyHref(w)} onClick={() => setStatus(w, 'notified')}
                className="text-[11px] font-bold bg-emerald-600 text-white rounded-xl px-3 py-2 flex items-center gap-1 shrink-0">
                <MessageCircle className="w-3.5 h-3.5" /> {t.notify}
              </a>
              <button onClick={() => setStatus(w, 'done')} className="text-[11px] font-bold border border-black/10 rounded-xl px-3 py-2 shrink-0">{t.markDone}</button>
            </div>
          ))}
          {active.length === 0 && <p className="p-8 text-center text-sm text-slate-400">{t.empty}</p>}
        </div>
      </Card>
    </div>
  );
}
