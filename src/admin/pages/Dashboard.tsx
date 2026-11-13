import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, UserPlus, Clock } from 'lucide-react';
import { adminT, type AdminLang } from '../adminI18n';
import {
  adminListAppointments, adminListPatients, adminListFinancials, adminSetAppointmentStatus,
  type Appointment, type Patient, type Financial,
} from '../../lib/supabase';
import { toYMD } from '../../lib/clinic';
import { Card, StatusPill, svcLabel, initials, fmtDZD } from '../ui';

export default function Dashboard({ lang }: { lang: AdminLang }) {
  const t = adminT[lang];
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [fins, setFins] = useState<Financial[]>([]);
  const today = toYMD(new Date());
  const hour = new Date().getHours();

  async function load() {
    const a = await adminListAppointments('2000-01-01', '2100-01-01');
    setAppts(a);
    setPatients(await adminListPatients());
    setFins(await adminListFinancials());
  }
  useEffect(() => { load(); }, []);

  const active = (a: Appointment) => a.status !== 'cancelled' && a.status !== 'no_show';
  const todayList = appts.filter((a) => a.appt_date === today && active(a));
  const inClinic = todayList.filter((a) => a.status === 'checked_in' || a.status === 'in_treatment').length;
  const pendingAll = appts.filter((a) => a.status === 'pending');
  const overdue = fins.reduce((s, f) => s + Math.max(0, Number(f.total_cost) - Number(f.amount_paid)), 0);
  const overdueCount = fins.filter((f) => Number(f.total_cost) - Number(f.amount_paid) > 0).length;
  const dateStr = new Date().toLocaleDateString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  async function quickConfirm(id: string) {
    await adminSetAppointmentStatus(id, 'confirmed');
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{hour < 18 ? t.morning : t.evening}, Admin</h1>
          <p className="text-sm text-slate-500 mt-0.5">{dateStr}</p>
        </div>
        <div className="flex gap-2">
          <Link to="../patients" className="flex items-center gap-1.5 text-xs font-bold border border-black/10 bg-white rounded-2xl px-4 py-2.5 hover:border-slate-400">
            <UserPlus className="w-4 h-4" /> {t.newPatient}
          </Link>
          <Link to="../agenda" className="flex items-center gap-1.5 text-xs font-bold bg-[#253F31] text-white rounded-2xl px-4 py-2.5 hover:bg-black">
            <CalendarPlus className="w-4 h-4" /> {t.newAppt}
          </Link>
        </div>
      </div>

      <div className="mt-5 grid sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs text-slate-500 font-medium">{t.apptToday}</div>
          <div className="mt-1 text-4xl font-bold">{todayList.length}</div>
          <div className="mt-1 text-xs text-slate-400">
            {todayList.filter((a) => a.status === 'confirmed').length} ✓ • {todayList.filter((a) => a.status === 'pending').length} ⏳
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-slate-500 font-medium">{t.nowInClinic}</div>
          <div className="mt-1 text-4xl font-bold">{inClinic}</div>
          <div className="mt-1 text-xs text-slate-400">{inClinic === 0 ? t.nobodyInClinic : ''}</div>
        </Card>
        <Card className="p-5 border-s-4 border-s-rose-500 !bg-rose-50">
          <div className="text-xs text-rose-700 font-bold">{t.overdue} ({overdueCount})</div>
          <div className="mt-1 text-4xl font-bold text-rose-700">{fmtDZD(overdue)}</div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
          <div className="font-bold text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-sky-600" /> {t.apptToday}</div>
          <Link to="../agenda" className="text-xs font-bold text-slate-500 hover:text-slate-900">{t.openAgenda} ←</Link>
        </div>
        {todayList.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">{t.noApptToday}</p>
        ) : (
          <div className="divide-y divide-black/5">
            {todayList.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                <span className="font-mono font-bold text-slate-500" dir="ltr">{a.appt_time.slice(0, 5)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{a.patient?.full_name}</div>
                  <div className="text-xs text-slate-500">{svcLabel(a.service_code, lang)}</div>
                </div>
                <StatusPill status={a.status} lang={lang} />
                {a.status === 'pending' && (
                  <button onClick={() => quickConfirm(a.id)} className="text-[11px] font-bold bg-emerald-600 text-white rounded-xl px-3 py-1.5">✓</button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <Card>
          <div className="px-5 py-4 border-b border-black/5 font-bold text-sm">⏳ {t.toConfirm} ({pendingAll.length})</div>
          <div className="divide-y divide-black/5 max-h-64 overflow-auto">
            {pendingAll.slice(0, 8).map((a) => (
              <div key={a.id} className="px-5 py-2.5 text-sm flex items-center justify-between gap-2">
                <span className="font-bold truncate">{a.patient?.full_name} <span className="font-normal text-slate-400" dir="ltr">{a.patient?.phone}</span></span>
                <span className="text-xs text-slate-500 whitespace-nowrap" dir="ltr">{a.appt_date.slice(5)} • {a.appt_time.slice(0, 5)}</span>
              </div>
            ))}
            {pendingAll.length === 0 && <p className="p-6 text-center text-xs text-slate-400">{t.empty}</p>}
          </div>
        </Card>
        <Card>
          <div className="px-5 py-4 border-b border-black/5 font-bold text-sm">👥 {t.recentPatients}</div>
          <div className="divide-y divide-black/5">
            {patients.slice(0, 5).map((p) => (
              <div key={p.id} className="px-5 py-2.5 text-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#EEF4F0] text-[#253F31] flex items-center justify-center text-xs font-bold">{initials(p.full_name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{p.full_name}</div>
                  <div className="text-xs text-slate-400" dir="ltr">{p.phone}</div>
                </div>
              </div>
            ))}
            {patients.length === 0 && <p className="p-6 text-center text-xs text-slate-400">{t.empty}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
