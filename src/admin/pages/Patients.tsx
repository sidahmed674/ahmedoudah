import { useEffect, useMemo, useState } from 'react';
import { X, MessageCircle, FileDown, Plus, Receipt } from 'lucide-react';
import { adminT, type AdminLang } from '../adminI18n';
import {
  adminListPatients, adminListAppointments, adminListPlans, adminListPayments, adminGetFinancial,
  adminAddPayment, adminSaveFinancial, adminAddPlanItem, adminSetPlanStatus, adminCreatePatient,
  type Patient, type Appointment, type PlanItem, type Payment, type Financial,
} from '../../lib/supabase';
import { SERVICE_IDS, validDZPhone, normalizeDZPhone } from '../../lib/clinic';
import { waGeneral } from '../../lib/whatsapp';
import { patientPDF, receiptPDF } from '../../lib/pdf';
import { Card, StatusPill, PlanPill, svcLabel, initials, fmtDZD } from '../ui';

export default function Patients({ lang }: { lang: AdminLang }) {
  const t = adminT[lang];
  const [patients, setPatients] = useState<Patient[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Patient | null>(null);
  const [adding, setAdding] = useState(false);
  const [nName, setNName] = useState('');
  const [nPhone, setNPhone] = useState('');

  async function load() {
    setPatients(await adminListPatients());
    if (sel) {
      const fresh = (await adminListPatients()).find((p) => p.id === sel.id);
      if (fresh) setSel(fresh);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => patients.filter((p) => q === '' || p.full_name.includes(q) || p.phone.includes(q)),
    [patients, q],
  );

  async function add() {
    const ph = normalizeDZPhone(nPhone);
    if (!nName.trim() || !validDZPhone(ph)) return;
    const p = await adminCreatePatient({ full_name: nName.trim(), phone: ph });
    if (p) { setAdding(false); setNName(''); setNPhone(''); load(); }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.menu.patients} ({filtered.length})</h1>
        <button onClick={() => setAdding(!adding)} className="flex items-center gap-1.5 text-xs font-bold bg-[#253F31] text-white rounded-2xl px-4 py-2.5">
          <Plus className="w-4 h-4" /> {t.newPatient}
        </button>
      </div>
      {adding && (
        <Card className="mt-3 p-4 flex flex-col sm:flex-row gap-2">
          <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder={t.name} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
          <input value={nPhone} onChange={(e) => setNPhone(e.target.value)} placeholder="05/06/07…" dir="ltr" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none text-left" />
          <button onClick={add} className="rounded-xl bg-[#253F31] text-white px-5 py-2 text-sm font-bold">{t.save}</button>
        </Card>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search}
        className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#253F31]" />

      <Card className="mt-3 overflow-hidden">
        <div className="divide-y divide-black/5">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => setSel(p)} className="w-full px-4 py-3 flex items-center gap-3 text-start hover:bg-slate-50">
              <div className="w-9 h-9 rounded-full bg-[#EEF4F0] text-[#253F31] flex items-center justify-center text-xs font-bold shrink-0">{initials(p.full_name)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{p.full_name}</div>
                <div className="text-xs text-slate-400" dir="ltr">{p.phone} {p.patient_code ? `• ${p.patient_code}` : ''}</div>
              </div>
              <span className="text-xs font-bold text-[#253F31]">{t.dossier} ←</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="p-8 text-center text-sm text-slate-400">{t.empty}</p>}
        </div>
      </Card>

      {sel && <Dossier lang={lang} patient={sel} onClose={() => setSel(null)} onChange={load} />}
    </div>
  );
}

function Dossier({ lang, patient, onClose, onChange }: {
  lang: AdminLang; patient: Patient; onClose: () => void; onChange: () => void;
}) {
  const t = adminT[lang];
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fin, setFin] = useState<Financial | null>(null);
  const [total, setTotal] = useState('');
  const [pAmount, setPAmount] = useState('');
  const [pMethod, setPMethod] = useState<'cash' | 'ccp' | 'transfer'>('cash');
  const [pLabel, setPLabel] = useState('');
  const [plService, setPlService] = useState('other');
  const [plCost, setPlCost] = useState('');

  async function load() {
    const [a, pl, pay, f] = await Promise.all([
      adminListAppointments('2000-01-01', '2100-01-01'),
      adminListPlans(patient.id),
      adminListPayments(patient.id),
      adminGetFinancial(patient.id),
    ]);
    setAppts(a.filter((x) => x.patient_id === patient.id));
    setPlans(pl);
    setPayments(pay);
    setFin(f);
    if (f) setTotal(String(f.total_cost));
  }
  useEffect(() => { load(); }, [patient.id]);

  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalN = fin ? Number(fin.total_cost) : 0;
  const rest = Math.max(0, totalN - Math.max(paid, fin ? Number(fin.amount_paid) : 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-[#faf9f7] w-full max-w-lg h-full overflow-y-auto p-4 sm:p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{patient.full_name}</h2>
            <p className="text-xs text-slate-500" dir="ltr">{patient.phone} {patient.patient_code ? `• ${patient.patient_code}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <a target="_blank" rel="noreferrer" href={waGeneral()}
            className="text-xs font-bold bg-emerald-600 text-white rounded-xl px-3 py-2 flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {t.whatsapp}</a>
          <button onClick={() => patientPDF(patient, appts, plans, payments, fin, (c) => svcLabel(c, 'fr'))}
            className="text-xs font-bold border border-black/10 bg-white rounded-xl px-3 py-2 flex items-center gap-1"><FileDown className="w-3.5 h-3.5" /> {t.exportPDF}</button>
        </div>

        {/* المالية */}
        <div className="mt-4 bg-white rounded-3xl border border-black/5 p-4">
          <div className="text-sm font-bold">💰 {t.total}: {fmtDZD(totalN)} • {t.paid}: {fmtDZD(Math.max(paid, fin ? Number(fin.amount_paid) : 0))} • <span className="text-rose-600">{t.remaining}: {fmtDZD(rest)}</span></div>
          <div className="mt-2 flex gap-2">
            <input value={total} onChange={(e) => setTotal(e.target.value)} type="number" placeholder={t.total} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
            <button onClick={async () => {
              await adminSaveFinancial({ patient_id: patient.id, total_cost: Number(total) || 0, amount_paid: fin?.amount_paid ?? paid });
              load(); onChange();
            }} className="rounded-xl bg-[#253F31] text-white px-4 text-xs font-bold">{t.save}</button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <input value={pAmount} onChange={(e) => setPAmount(e.target.value)} type="number" placeholder={t.amount} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
            <select value={pMethod} onChange={(e) => setPMethod(e.target.value as any)} className="rounded-xl border border-slate-200 px-2 py-2 text-sm bg-white">
              <option value="cash">{t.cash}</option>
              <option value="ccp">{t.ccp}</option>
              <option value="transfer">{t.transfer}</option>
            </select>
            <input value={pLabel} onChange={(e) => setPLabel(e.target.value)} placeholder={t.label} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
          </div>
          <button onClick={async () => {
            if (!Number(pAmount)) return;
            await adminAddPayment({ patient_id: patient.id, amount: Number(pAmount), method: pMethod, label: pLabel || undefined });
            receiptPDF(patient, Number(pAmount), pMethod, pLabel || undefined);
            setPAmount(''); setPLabel(''); load(); onChange();
          }} className="mt-2 w-full rounded-xl border-2 border-dashed border-[#253F31]/30 py-2 text-xs font-bold text-[#253F31]">+ {t.addPayment} + {t.receipt} PDF</button>
          <div className="mt-2 space-y-1">
            {payments.map((p) => (
              <div key={p.id} className="text-xs flex justify-between bg-slate-50 rounded-lg px-2.5 py-1.5">
                <span>{(p.created_at ?? '').slice(0, 10)} • {p.label || '—'} • {p.method}</span>
                <b>{fmtDZD(p.amount)}</b>
              </div>
            ))}
          </div>
        </div>

        {/* خطة العلاج */}
        <div className="mt-3 bg-white rounded-3xl border border-black/5 p-4">
          <div className="text-sm font-bold">📋 {t.plan}</div>
          <div className="mt-2 space-y-1.5">
            {plans.map((pl) => (
              <div key={pl.id} className="text-xs flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-2.5 py-2">
                <div>
                  <b>{svcLabel(pl.service_code, lang)}</b> • {fmtDZD(pl.agreed_cost)}
                  <div className="mt-0.5"><PlanPill status={pl.status} lang={lang} /></div>
                </div>
                <div className="flex gap-1">
                  {pl.status === 'pending' && <button onClick={() => adminSetPlanStatus(pl.id, 'in_progress').then(load)} className="bg-sky-600 text-white rounded-lg px-2 py-1 font-bold">▶</button>}
                  {pl.status === 'in_progress' && <button onClick={() => adminSetPlanStatus(pl.id, 'completed').then(load)} className="bg-emerald-600 text-white rounded-lg px-2 py-1 font-bold">✓</button>}
                </div>
              </div>
            ))}
            {plans.length === 0 && <p className="text-xs text-slate-400">{t.noPlans}</p>}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <select value={plService} onChange={(e) => setPlService(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-2 text-xs bg-white">
              {SERVICE_IDS.map((s) => <option key={s} value={s}>{svcLabel(s, lang)}</option>)}
            </select>
            <input value={plCost} onChange={(e) => setPlCost(e.target.value)} type="number" placeholder={t.cost} className="rounded-xl border border-slate-200 px-2 py-2 text-xs outline-none" />
            <button onClick={async () => {
              await adminAddPlanItem({ patient_id: patient.id, service_code: plService, status: 'pending', agreed_cost: Number(plCost) || 0 });
              setPlCost(''); load();
            }} className="rounded-xl bg-slate-900 text-white text-xs font-bold">+ {t.addPlanItem}</button>
          </div>
        </div>

        {/* المواعيد */}
        <div className="mt-3 bg-white rounded-3xl border border-black/5 p-4">
          <div className="text-sm font-bold">📅 {t.appointments}</div>
          <div className="mt-2 space-y-1.5">
            {appts.map((a) => (
              <div key={a.id} className="text-xs flex items-center justify-between bg-slate-50 rounded-xl px-2.5 py-2">
                <span dir="ltr" className="font-mono">{a.appt_date.slice(5)} • {a.appt_time.slice(0, 5)}</span>
                <span>{svcLabel(a.service_code, lang)}</span>
                <StatusPill status={a.status} lang={lang} />
              </div>
            ))}
            {appts.length === 0 && <p className="text-xs text-slate-400">{t.empty}</p>}
          </div>
        </div>

        {patient.medical_history && (
          <div className="mt-3 bg-white rounded-3xl border border-black/5 p-4 text-xs">
            <b>{t.medical}:</b> {patient.medical_history}
          </div>
        )}
        <div className="h-6" />
      </div>
    </div>
  );
}

export function ReceiptIcon() {
  return <Receipt className="w-3.5 h-3.5" />;
}
