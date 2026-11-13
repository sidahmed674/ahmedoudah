import { useEffect, useState } from 'react';
import { adminT, type AdminLang } from '../adminI18n';
import { adminListPayments, adminListFinancials, adminListPatients, type Payment, type Financial, type Patient } from '../../lib/supabase';
import { Card, fmtDZD } from '../ui';

export default function Finances({ lang }: { lang: AdminLang }) {
  const t = adminT[lang];
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fins, setFins] = useState<Financial[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    (async () => {
      setPayments(await adminListPayments());
      setFins(await adminListFinancials());
      setPatients(await adminListPatients());
    })();
  }, []);

  const monthStart = new Date().toISOString().slice(0, 7);
  const collected = payments.filter((p) => (p.created_at ?? '').startsWith(monthStart)).reduce((s, p) => s + Number(p.amount), 0);
  const due = fins.reduce((s, f) => s + Math.max(0, Number(f.total_cost) - Number(f.amount_paid)), 0);
  const nameOf = (id: string) => patients.find((p) => p.id === id);
  const debtors = fins
    .map((f) => ({ f, p: nameOf(f.patient_id), rest: Number(f.total_cost) - Number(f.amount_paid) }))
    .filter((x) => x.rest > 0)
    .sort((a, b) => b.rest - a.rest);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t.menu.finances}</h1>
      <div className="mt-4 grid sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs text-slate-500 font-medium">{t.collected}</div>
          <div className="mt-1 text-3xl font-bold text-emerald-700">{fmtDZD(collected)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-slate-500 font-medium">{t.totalRemaining}</div>
          <div className="mt-1 text-3xl font-bold text-rose-600">{fmtDZD(due)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-slate-500 font-medium">{t.payments}</div>
          <div className="mt-1 text-3xl font-bold">{payments.length}</div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="px-5 py-4 border-b border-black/5 font-bold text-sm">⚠️ {t.totalRemaining} ({debtors.length})</div>
        <div className="divide-y divide-black/5 max-h-72 overflow-auto">
          {debtors.map(({ f, p, rest }) => (
            <div key={f.patient_id} className="px-5 py-2.5 text-sm flex items-center justify-between">
              <span className="font-bold">{p?.full_name ?? '—'} <span className="font-normal text-slate-400 text-xs" dir="ltr">{p?.phone}</span></span>
              <span className="font-bold text-rose-600">{fmtDZD(rest)} <span className="text-slate-400 font-normal text-xs">/ {fmtDZD(f.total_cost)}</span></span>
            </div>
          ))}
          {debtors.length === 0 && <p className="p-6 text-center text-xs text-slate-400">{t.empty}</p>}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="px-5 py-4 border-b border-black/5 font-bold text-sm">🧾 {t.payments}</div>
        <div className="divide-y divide-black/5 max-h-80 overflow-auto">
          {payments.map((p) => (
            <div key={p.id} className="px-5 py-2.5 text-sm flex items-center justify-between">
              <span>{(p.created_at ?? '').slice(0, 10)} • <b>{nameOf(p.patient_id)?.full_name ?? '—'}</b> • {p.label || '—'} • {p.method}</span>
              <b className="text-emerald-700">{fmtDZD(p.amount)}</b>
            </div>
          ))}
          {payments.length === 0 && <p className="p-6 text-center text-xs text-slate-400">{t.empty}</p>}
        </div>
      </Card>
    </div>
  );
}
