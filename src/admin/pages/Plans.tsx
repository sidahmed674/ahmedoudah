import { useEffect, useState } from 'react';
import { adminT, type AdminLang } from '../adminI18n';
import { adminListPlans, adminListPatients, adminSetPlanStatus, type PlanItem, type Patient } from '../../lib/supabase';
import { Card, PlanPill, svcLabel, fmtDZD } from '../ui';

export default function Plans({ lang }: { lang: AdminLang }) {
  const t = adminT[lang];
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filter, setFilter] = useState('');

  async function load() {
    setPlans(await adminListPlans());
    setPatients(await adminListPatients());
  }
  useEffect(() => { load(); }, []);

  const nameOf = (id: string) => patients.find((p) => p.id === id)?.full_name ?? '—';
  const shown = plans.filter((p) => !filter || p.status === filter);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.menu.plans} ({shown.length})</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="text-xs font-bold border border-black/10 bg-white rounded-xl px-3 py-2">
          <option value="">—</option>
          {Object.entries(t.planStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="divide-y divide-black/5">
          {shown.map((p) => (
            <div key={p.id} className="px-4 py-3 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{nameOf(p.patient_id)}</div>
                <div className="text-xs text-slate-500">{svcLabel(p.service_code, lang)} • {fmtDZD(p.agreed_cost)}</div>
              </div>
              <PlanPill status={p.status} lang={lang} />
              <div className="flex gap-1">
                {p.status === 'pending' && (
                  <button onClick={() => adminSetPlanStatus(p.id, 'in_progress').then(load)} className="text-[11px] font-bold bg-sky-600 text-white rounded-lg px-2.5 py-1.5">▶</button>
                )}
                {p.status === 'in_progress' && (
                  <button onClick={() => adminSetPlanStatus(p.id, 'completed').then(load)} className="text-[11px] font-bold bg-emerald-600 text-white rounded-lg px-2.5 py-1.5">✓</button>
                )}
              </div>
            </div>
          ))}
          {shown.length === 0 && <p className="p-8 text-center text-sm text-slate-400">{t.empty}</p>}
        </div>
      </Card>
    </div>
  );
}
