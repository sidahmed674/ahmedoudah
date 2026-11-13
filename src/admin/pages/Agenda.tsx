import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, MessageCircle } from 'lucide-react';
import { adminT, type AdminLang } from '../adminI18n';
import {
  adminListAppointments, adminListPatients, adminSetAppointmentStatus, adminCreatePatient,
  adminCreateAppointment, getBookedTimes, type Appointment, type Patient,
} from '../../lib/supabase';
import { CLINIC, SERVICE_IDS, TIME_SLOTS, isWorkDay, toYMD, validDZPhone, normalizeDZPhone } from '../../lib/clinic';
import { waConfirm, waRemind } from '../../lib/whatsapp';
import { Card, StatusPill, svcLabel } from '../ui';

const NEXT: Record<string, Appointment['status'][]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['in_treatment', 'no_show'],
  in_treatment: ['completed'],
  completed: [], cancelled: [], no_show: [],
};
const ACT_LABEL: Record<string, 'confirmBtn' | 'checkin' | 'startTreat' | 'complete' | 'cancelBtn' | 'noshow'> = {
  confirmed: 'confirmBtn', checked_in: 'checkin', in_treatment: 'startTreat',
  completed: 'complete', cancelled: 'cancelBtn', no_show: 'noshow',
};

export default function Agenda({ lang }: { lang: AdminLang }) {
  const t = adminT[lang];
  const rtl = lang === 'ar';
  const [weekOff, setWeekOff] = useState(0);
  const [view, setView] = useState<'week' | 'day' | 'kanban'>('week');
  const [dayOff, setDayOff] = useState(0);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sel, setSel] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + weekOff * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOff]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  }), [weekStart]);

  const selDay = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dayOff]);

  async function load() {
    if (view === 'week') {
      setAppts(await adminListAppointments(toYMD(days[0]), toYMD(days[6])));
    } else {
      setAppts(await adminListAppointments(toYMD(selDay), toYMD(selDay)));
    }
    setPatients(await adminListPatients());
  }
  useEffect(() => { load(); }, [weekOff, dayOff, view]);

  const byCell = useMemo(() => {
    const m = new Map<string, Appointment>();
    appts.forEach((a) => {
      if (a.status === 'cancelled') return;
      m.set(`${a.appt_date}|${a.appt_time.slice(0, 5)}`, a);
    });
    return m;
  }, [appts]);

  async function setStatus(a: Appointment, s: Appointment['status']) {
    if (await adminSetAppointmentStatus(a.id, s)) { setSel(null); load(); setMsg(t.updated); }
    else setMsg(t.error);
  }

  const weekLabel = `${days[0].toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const dayLabel = selDay.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const dayList = [...appts].filter((a) => a.status !== 'cancelled')
    .sort((x, y) => x.appt_time.localeCompare(y.appt_time));
  const kanbanCols: Appointment['status'][] = ['pending', 'confirmed', 'checked_in', 'in_treatment', 'completed'];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.menu.agenda}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-white border border-black/10 rounded-2xl p-1 text-xs font-bold">
            {(['week', 'day', 'kanban'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3.5 py-2 rounded-xl ${view === v ? 'bg-[#253F31] text-white' : 'text-slate-500'}`}>
                {v === 'week' ? t.viewWeek : v === 'day' ? t.viewDay : t.viewKanban}
              </button>
            ))}
          </div>
          <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 text-xs font-bold bg-[#253F31] text-white rounded-2xl px-4 py-2.5">
            <Plus className="w-4 h-4" /> {t.newAppt}
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {view === 'week' ? (
          <>
            <button onClick={() => setWeekOff(weekOff - 1)} className="w-9 h-9 rounded-xl bg-white border border-black/10 flex items-center justify-center">
              {rtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <button onClick={() => setWeekOff(0)} className="text-xs font-bold bg-white border border-black/10 rounded-xl px-3.5 h-9">{t.todayBtn}</button>
            <button onClick={() => setWeekOff(weekOff + 1)} className="w-9 h-9 rounded-xl bg-white border border-black/10 flex items-center justify-center">
              {rtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <span className="text-sm font-bold ms-2">{weekLabel}</span>
          </>
        ) : (
          <>
            <button onClick={() => setDayOff(dayOff - 1)} className="w-9 h-9 rounded-xl bg-white border border-black/10 flex items-center justify-center">
              {rtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <button onClick={() => setDayOff(0)} className="text-xs font-bold bg-white border border-black/10 rounded-xl px-3.5 h-9">{t.todayBtn}</button>
            <button onClick={() => setDayOff(dayOff + 1)} className="w-9 h-9 rounded-xl bg-white border border-black/10 flex items-center justify-center">
              {rtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <span className="text-sm font-bold ms-2">{dayLabel}</span>
          </>
        )}
      </div>
      {msg && <p className="mt-3 text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-2.5 w-fit">{msg}</p>}

      {view === 'week' && (
      <Card className="mt-4 overflow-auto">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-black/5 bg-slate-50/70">
            <div />
            {days.map((d) => (
              <div key={d.toISOString()} className="px-2 py-3 text-center">
                <div className="text-[11px] font-bold text-slate-400 uppercase">
                  {d.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'fr-FR', { weekday: 'short' })}
                </div>
                <div className={`text-sm font-bold ${toYMD(d) === toYMD(new Date()) ? 'text-[#2f7c4f]' : ''}`}>{d.getDate()}</div>
              </div>
            ))}
          </div>
          {TIME_SLOTS.map((slot) => (
            <div key={slot} className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-black/5 last:border-0 min-h-[44px]">
              <div className="text-[11px] font-mono text-slate-400 flex items-start justify-center pt-2" dir="ltr">{slot}</div>
              {days.map((d) => {
                const ymd = toYMD(d);
                if (!isWorkDay(d)) {
                  return <div key={ymd} className="border-s border-black/5 bg-[repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9_6px,#e8eef4_6px,#e8eef4_12px)]" />;
                }
                const a = byCell.get(`${ymd}|${slot}`);
                return (
                  <div key={ymd} className="border-s border-black/5 p-1">
                    {a && (
                      <button onClick={() => setSel(a)}
                        className={`w-full text-start text-[11px] rounded-xl border-s-4 px-2 py-1.5 leading-tight hover:shadow ${a.status === 'confirmed' ? 'bg-emerald-50 border-emerald-500' : a.status === 'pending' ? 'bg-amber-50 border-amber-400' : a.status === 'completed' ? 'bg-slate-100 border-slate-400' : 'bg-sky-50 border-sky-500'}`}>
                        <div className="font-bold truncate">{a.patient?.full_name}</div>
                        <div className="text-slate-500 truncate">{svcLabel(a.service_code, lang)}</div>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>
      )}

      {view === 'day' && (
        <Card className="mt-4 overflow-hidden">
          {!isWorkDay(selDay) ? (
            <p className="p-10 text-center text-sm font-bold text-slate-400">{t.closed}</p>
          ) : dayList.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-400">{t.noApptToday}</p>
          ) : (
            <div className="divide-y divide-black/5">
              {dayList.map((a) => (
                <button key={a.id} onClick={() => setSel(a)} className="w-full px-5 py-3 flex items-center gap-3 text-start hover:bg-slate-50 text-sm">
                  <span className="font-mono font-bold text-slate-500 w-12" dir="ltr">{a.appt_time.slice(0, 5)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{a.patient?.full_name}</div>
                    <div className="text-xs text-slate-500">{svcLabel(a.service_code, lang)}</div>
                  </div>
                  <StatusPill status={a.status} lang={lang} />
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {view === 'kanban' && (
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {kanbanCols.map((col) => {
            const cards = dayList.filter((a) => a.status === col);
            return (
              <div key={col} className="bg-slate-100/70 rounded-3xl p-2.5 min-h-[180px]">
                <div className="px-2 py-2 text-xs font-bold text-slate-600 flex items-center justify-between">
                  <span>{(t.status as Record<string, string>)[col]}</span>
                  <span className="bg-white rounded-full px-2 py-0.5">{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {cards.map((a) => (
                    <button key={a.id} onClick={() => setSel(a)}
                      className="w-full text-start bg-white rounded-2xl border border-black/5 shadow-sm p-2.5 hover:shadow text-xs">
                      <div className="font-mono font-bold text-slate-400" dir="ltr">{a.appt_time.slice(0, 5)}</div>
                      <div className="font-bold truncate mt-0.5">{a.patient?.full_name}</div>
                      <div className="text-slate-500 truncate">{svcLabel(a.service_code, lang)}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details modal */}
      {sel && (
        <Modal onClose={() => setSel(null)}>
          <h3 className="font-bold">{sel.patient?.full_name}</h3>
          <p className="text-xs text-slate-500 mt-0.5" dir="ltr">{sel.patient?.phone} • {sel.appt_date} {sel.appt_time.slice(0, 5)}</p>
          <p className="text-sm mt-1">{svcLabel(sel.service_code, lang)}</p>
          <div className="mt-2"><StatusPill status={sel.status} lang={lang} /></div>
          {sel.notes && <p className="mt-2 text-xs bg-slate-50 border rounded-xl p-2.5">{sel.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(NEXT[sel.status] ?? []).map((s) => (
              <button key={s} onClick={() => setStatus(sel, s)}
                className={`text-xs font-bold rounded-xl px-3 py-2 ${s === 'cancelled' || s === 'no_show' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-[#253F31] text-white'}`}>
                {t[ACT_LABEL[s]]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <a target="_blank" rel="noreferrer" href={waConfirm(sel.patient?.full_name ?? '', svcLabel(sel.service_code, lang), sel.appt_date, sel.appt_time.slice(0, 5))}
              className="text-xs font-bold rounded-xl px-3 py-2 bg-emerald-600 text-white flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {t.confirmBtn}</a>
            <a target="_blank" rel="noreferrer" href={waRemind(sel.patient?.full_name ?? '', svcLabel(sel.service_code, lang), sel.appt_date, sel.appt_time.slice(0, 5))}
              className="text-xs font-bold rounded-xl px-3 py-2 border border-black/10">⏰ {t.remind}</a>
          </div>
        </Modal>
      )}

      {creating && (
        <CreateModal lang={lang} patients={patients} onClose={() => setCreating(false)}
          onDone={() => { setCreating(false); load(); setMsg(t.created); }} />
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateModal({ lang, patients, onClose, onDone }: {
  lang: AdminLang; patients: Patient[]; onClose: () => void; onDone: () => void;
}) {
  const t = adminT[lang];
  const [q, setQ] = useState('');
  const [patientId, setPatientId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [service, setService] = useState('other');
  const [date, setDate] = useState(toYMD(new Date()));
  const [time, setTime] = useState('');
  const [booked, setBooked] = useState<string[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (date) getBookedTimes(date).then(setBooked);
  }, [date]);

  const filtered = patients.filter((p) => q === '' || p.full_name.includes(q) || p.phone.includes(q)).slice(0, 6);
  const closedDay = date ? !isWorkDay(new Date(date + 'T12:00:00')) : false;

  async function submit() {
    setErr('');
    let pid = patientId;
    if (!pid) {
      const ph = normalizeDZPhone(newPhone);
      if (!newName.trim() || !validDZPhone(ph)) { setErr(t.error); return; }
      const p = await adminCreatePatient({ full_name: newName.trim(), phone: ph });
      if (!p) { setErr(t.error); return; }
      pid = p.id;
    }
    if (!date || !time || closedDay || booked.includes(time)) { setErr(t.error); return; }
    const ok = await adminCreateAppointment({ patient_id: pid, service_code: service, appt_date: date, appt_time: time });
    if (ok) onDone();
    else setErr(t.error);
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="font-bold">{t.createTitle}</h3>
      <label className="block text-xs font-bold mt-3">{t.pickPatient}</label>
      <input value={q} onChange={(e) => { setQ(e.target.value); setPatientId(''); }} placeholder={t.search}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
      {q && (
        <div className="mt-1 border border-slate-100 rounded-xl overflow-hidden">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => { setPatientId(p.id); setQ(`${p.full_name} (${p.phone})`); }}
              className="w-full text-start px-3 py-2 text-xs hover:bg-slate-50">{p.full_name} <span className="text-slate-400" dir="ltr">{p.phone}</span></button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-slate-400 mt-3">{t.orNew}</p>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t.name} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" />
        <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="05/06/07…" dir="ltr" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none text-left" />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <label className="text-xs font-bold">{t.service}</label>
          <select value={service} onChange={(e) => setService(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm bg-white">
            {SERVICE_IDS.map((s) => <option key={s} value={s}>{svcLabel(s, lang)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold">{t.date}</label>
          <input type="date" value={date} min={toYMD(new Date())} onChange={(e) => { setDate(e.target.value); setTime(''); }}
            className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm" />
        </div>
      </div>
      <label className="block text-xs font-bold mt-2">{t.time} {closedDay && <span className="text-rose-600">— {t.closed}</span>}</label>
      <div className="mt-1 grid grid-cols-4 gap-1.5 max-h-36 overflow-auto">
        {TIME_SLOTS.map((s) => {
          const taken = booked.includes(s);
          return (
            <button key={s} disabled={taken} onClick={() => setTime(s)} dir="ltr"
              className={`text-xs font-mono font-bold rounded-lg border py-1.5 ${time === s ? 'bg-[#253F31] text-white border-[#253F31]' : taken ? 'opacity-30 line-through' : 'hover:border-slate-500'}`}>{s}</button>
          );
        })}
      </div>
      {err && <p className="mt-2 text-xs font-bold text-rose-600">{err}</p>}
      <button onClick={submit} className="mt-3 w-full rounded-2xl bg-[#253F31] text-white py-2.5 text-sm font-bold">{t.create}</button>
      <p className="mt-2 text-[10px] text-slate-400">CLINIC {CLINIC.workStart}–{CLINIC.workEnd}</p>
    </Modal>
  );
}
