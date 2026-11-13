import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { adminT, type AdminLang } from '../adminI18n';
import { adminListFeedback, adminSetFeedbackStatus, type Feedback } from '../../lib/supabase';
import { Card } from '../ui';

export default function Reviews({ lang }: { lang: AdminLang }) {
  const t = adminT[lang];
  const [list, setList] = useState<Feedback[]>([]);

  async function load() {
    setList(await adminListFeedback());
  }
  useEffect(() => { load(); }, []);

  async function setStatus(f: Feedback, s: Feedback['status']) {
    await adminSetFeedbackStatus(f.id, s);
    load();
  }

  const badge = (s: string) =>
    s === 'published' ? 'bg-emerald-100 text-emerald-700' : s === 'hidden' ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-700';

  return (
    <div>
      <h1 className="text-2xl font-bold">{t.menu.reviews} ({list.length})</h1>
      <div className="mt-4 grid md:grid-cols-2 gap-3">
        {list.map((f) => (
          <Card key={f.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex text-amber-500">{Array.from({ length: f.rating }).map((_, i) => <Star key={i} className="w-3.5 h-3.5" fill="currentColor" />)}</div>
              <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 ${badge(f.status)}`}>
                {f.status === 'new' ? t.isNew : f.status === 'published' ? t.publish : t.hide}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed">“{f.message}”</p>
            <div className="mt-2 text-xs font-bold">{f.patient_name} <span className="font-normal text-slate-400" dir="ltr">{f.phone}</span></div>
            <div className="mt-3 flex gap-1.5">
              {f.status !== 'published' && (
                <button onClick={() => setStatus(f, 'published')} className="text-[11px] font-bold bg-emerald-600 text-white rounded-xl px-3 py-1.5">{t.publish}</button>
              )}
              {f.status !== 'hidden' && (
                <button onClick={() => setStatus(f, 'hidden')} className="text-[11px] font-bold border border-black/10 rounded-xl px-3 py-1.5">{t.hide}</button>
              )}
            </div>
          </Card>
        ))}
        {list.length === 0 && <Card className="p-8 text-center text-sm text-slate-400 md:col-span-2">{t.empty}</Card>}
      </div>
    </div>
  );
}
