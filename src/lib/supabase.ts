// ─── طبقة البيانات: Supabase حقيقي + وضع تجريبي محلي ───
// بدون VITE_SUPABASE_URL يعمل الموقع كاملا ببيانات تجريبية في localStorage.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { toYMD } from './clinic';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isCloud = Boolean(URL && KEY);
export const supa: SupabaseClient | null = isCloud ? createClient(URL!, KEY!) : null;

// ─── الأنواع ───
export interface Patient {
  id: string; patient_code?: string; full_name: string; phone: string;
  email?: string; birth_date?: string; address?: string;
  medical_history?: string; notes?: string; created_at?: string;
}
export interface Appointment {
  id: string; patient_id: string; doctor_id?: string;
  service_code: string; appt_date: string; appt_time: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_treatment' | 'completed' | 'cancelled' | 'no_show';
  notes?: string; source?: string; created_at?: string;
  patient?: Patient;
}
export interface WaitingEntry {
  id: string; full_name: string; phone: string;
  period: 'any' | 'morning' | 'evening'; service_code: string;
  status: 'waiting' | 'notified' | 'done' | 'cancelled'; created_at?: string;
}
export interface Feedback { id: string; patient_name: string; phone?: string; rating: number; message: string; status: 'new' | 'published' | 'hidden'; created_at?: string; }
export interface PlanItem { id: string; patient_id: string; service_code: string; status: 'pending' | 'in_progress' | 'completed' | 'cancelled'; agreed_cost: number; notes?: string; scheduled_date?: string; completed_date?: string; }
export interface Payment { id: string; patient_id: string; amount: number; method: 'cash' | 'ccp' | 'transfer'; label?: string; created_at?: string; }
export interface Financial { patient_id: string; total_cost: number; amount_paid: number; notes?: string; }

// ─── الوضع التجريبي (localStorage) ───
const DEMO_KEY = 'ouadah_demo_v1';
interface DemoDB { patients: Patient[]; appointments: Appointment[]; waiting: WaitingEntry[]; feedback: Feedback[]; plans: PlanItem[]; payments: Payment[]; financials: Financial[]; }

function demoSeed(): DemoDB {
  const d = new Date();
  const wd = d.getDay();
  const sun = new Date(d); sun.setDate(d.getDate() - wd); // أحد هذا الأسبوع
  const Y = (dt: Date) => toYMD(dt);
  const at = (dayOffset: number) => { const x = new Date(sun); x.setDate(sun.getDate() + dayOffset); return Y(x); };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const patients: Patient[] = [
    { id: 'p1', patient_code: 'P000001', full_name: 'أمين بن علي', phone: '0555259607' },
    { id: 'p2', patient_code: 'P000002', full_name: 'سارة مرابط', phone: '0661123490' },
    { id: 'p3', patient_code: 'P000003', full_name: 'خالد بوزيد', phone: '0771452218' },
    { id: 'p4', patient_code: 'P000004', full_name: 'فاطمة زروقي', phone: '0550981263' },
    { id: 'p5', patient_code: 'P000005', full_name: 'رياض بلقاسم', phone: '0665774120' },
  ];
  return {
    patients,
    appointments: [
      { id: uid(), patient_id: 'p1', service_code: 'crowns', appt_date: at(0), appt_time: '09:00', status: 'confirmed', patient: patients[0] },
      { id: uid(), patient_id: 'p2', service_code: 'gum', appt_date: at(0), appt_time: '09:30', status: 'confirmed', patient: patients[1] },
      { id: uid(), patient_id: 'p3', service_code: 'implants', appt_date: at(1), appt_time: '10:00', status: 'pending', patient: patients[2] },
      { id: uid(), patient_id: 'p4', service_code: 'ortho', appt_date: at(1), appt_time: '10:30', status: 'pending', patient: patients[3] },
      { id: uid(), patient_id: 'p5', service_code: 'whitening', appt_date: at(2), appt_time: '11:00', status: 'confirmed', patient: patients[4] },
    ],
    waiting: [
      { id: uid(), full_name: 'ياسمين قادري', phone: '0559112233', period: 'morning', service_code: 'whitening', status: 'waiting' },
      { id: uid(), full_name: 'محمد لمراني', phone: '0662445566', period: 'any', service_code: 'root-canal', status: 'waiting' },
    ],
    feedback: [
      { id: uid(), patient_name: 'أمين بن علي', phone: '0555259607', rating: 5, message: 'خدمة راقية وبدون ألم، شكرا دكتور.', status: 'published' },
      { id: uid(), patient_name: 'سارة مرابط', phone: '0661123490', rating: 5, message: 'عيادة نظيفة واستقبال محترم.', status: 'new' },
    ],
    plans: [
      { id: uid(), patient_id: 'p1', service_code: 'crowns', status: 'in_progress', agreed_cost: 18000 },
      { id: uid(), patient_id: 'p3', service_code: 'implants', status: 'pending', agreed_cost: 55000 },
    ],
    payments: [
      { id: uid(), patient_id: 'p1', amount: 9000, method: 'cash', label: 'دفعة أولى — تاج' },
    ],
    financials: [
      { patient_id: 'p1', total_cost: 18000, amount_paid: 9000 },
      { patient_id: 'p3', total_cost: 55000, amount_paid: 0 },
    ],
  };
}

function demoLoad(): DemoDB {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as DemoDB;
  } catch { /* ignore */ }
  const db = demoSeed();
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch { /* ignore */ }
  return db;
}
function demoSave(db: DemoDB) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}
const uid = () => Math.random().toString(36).slice(2, 10);

// ─── الحجز (موقع المرضى) ───
export async function getBookedTimes(dateYMD: string): Promise<string[]> {
  if (!supa) {
    const db = demoLoad();
    return db.appointments
      .filter((a) => a.appt_date === dateYMD && a.status !== 'cancelled' && a.status !== 'no_show')
      .map((a) => a.appt_time.slice(0, 5));
  }
  const { data } = await supa.from('appointments').select('appt_time')
    .eq('appt_date', dateYMD).not('status', 'in', '(cancelled,no_show)');
  return (data ?? []).map((r) => String(r.appt_time).slice(0, 5));
}

export async function createBooking(input: {
  name: string; phone: string; service: string; date: string; time: string; notes?: string;
}): Promise<{ ok: boolean; reason?: 'taken' | 'error' }> {
  if (!supa) {
    const db = demoLoad();
    const taken = db.appointments.some(
      (a) => a.appt_date === input.date && a.appt_time.slice(0, 5) === input.time && a.status !== 'cancelled' && a.status !== 'no_show',
    );
    if (taken) return { ok: false, reason: 'taken' };
    let patient = db.patients.find((p) => p.phone === input.phone);
    if (!patient) {
      patient = { id: uid(), patient_code: `P${String(db.patients.length + 1).padStart(6, '0')}`, full_name: input.name, phone: input.phone };
      db.patients.push(patient);
    }
    db.appointments.push({
      id: uid(), patient_id: patient.id, service_code: input.service,
      appt_date: input.date, appt_time: input.time, status: 'pending',
      notes: input.notes, source: 'website', patient,
    });
    demoSave(db);
    return { ok: true };
  }
  // مريض موجود بنفس الهاتف؟ وإلا ننشئه
  const { data: existing } = await supa.from('patients').select('id').eq('phone', input.phone).limit(1);
  let patientId = existing?.[0]?.id as string | undefined;
  if (!patientId) {
    const { data: created, error: e1 } = await supa.from('patients')
      .insert({ full_name: input.name, phone: input.phone }).select('id').single();
    if (e1 || !created) return { ok: false, reason: 'error' };
    patientId = created.id;
  }
  const { error: e2 } = await supa.from('appointments').insert({
    patient_id: patientId, service_code: input.service,
    appt_date: input.date, appt_time: input.time, notes: input.notes, source: 'website',
  });
  if (e2) {
    if ((e2 as { code?: string }).code === '23505') return { ok: false, reason: 'taken' };
    return { ok: false, reason: 'error' };
  }
  return { ok: true };
}

// ─── قائمة الانتظار (موقع المرضى) ───
export async function joinWaiting(input: { full_name: string; phone: string; period: WaitingEntry['period']; service_code: string }): Promise<boolean> {
  if (!supa) {
    const db = demoLoad();
    db.waiting.push({ id: uid(), status: 'waiting', ...input });
    demoSave(db);
    return true;
  }
  const { error } = await supa.from('waiting_list').insert(input);
  return !error;
}

// ─── آراء المرضى (موقع المرضى) ───
export async function sendFeedback(input: { patient_name: string; phone?: string; rating: number; message: string }): Promise<boolean> {
  if (!supa) {
    const db = demoLoad();
    db.feedback.push({ id: uid(), status: 'new', ...input });
    demoSave(db);
    return true;
  }
  const { error } = await supa.from('feedback').insert(input);
  return !error;
}

// ─── لوحة الطبيب: قراءة ───
export async function adminListFinancials(): Promise<Financial[]> {
  if (!supa) return demoLoad().financials;
  const { data } = await supa.from('patient_financials').select('*');
  return (data ?? []) as Financial[];
}
export async function adminListAppointments(from: string, to: string): Promise<Appointment[]> {
  if (!supa) {
    const db = demoLoad();
    return db.appointments
      .filter((a) => a.appt_date >= from && a.appt_date <= to)
      .sort((x, y) => (x.appt_date + x.appt_time).localeCompare(y.appt_date + y.appt_time))
      .map((a) => ({ ...a, patient: db.patients.find((p) => p.id === a.patient_id) }));
  }
  const { data } = await supa.from('appointments')
    .select('*, patient:patients(*)').gte('appt_date', from).lte('appt_date', to)
    .order('appt_date').order('appt_time');
  return (data ?? []) as Appointment[];
}
export async function adminListPatients(): Promise<Patient[]> {
  if (!supa) return demoLoad().patients;
  const { data } = await supa.from('patients').select('*').order('created_at', { ascending: false });
  return (data ?? []) as Patient[];
}
export async function adminListWaiting(): Promise<WaitingEntry[]> {
  if (!supa) return demoLoad().waiting;
  const { data } = await supa.from('waiting_list').select('*').order('created_at');
  return (data ?? []) as WaitingEntry[];
}
export async function adminListFeedback(): Promise<Feedback[]> {
  if (!supa) return demoLoad().feedback;
  const { data } = await supa.from('feedback').select('*').order('created_at', { ascending: false });
  return (data ?? []) as Feedback[];
}
export async function adminListPlans(patientId?: string): Promise<PlanItem[]> {
  if (!supa) {
    const db = demoLoad();
    return patientId ? db.plans.filter((p) => p.patient_id === patientId) : db.plans;
  }
  let q = supa.from('patient_services').select('*');
  if (patientId) q = q.eq('patient_id', patientId);
  const { data } = await q;
  return (data ?? []) as PlanItem[];
}
export async function adminListPayments(patientId?: string): Promise<Payment[]> {
  if (!supa) {
    const db = demoLoad();
    return patientId ? db.payments.filter((p) => p.patient_id === patientId) : db.payments;
  }
  let q = supa.from('payments').select('*').order('created_at', { ascending: false });
  if (patientId) q = q.eq('patient_id', patientId);
  const { data } = await q;
  return (data ?? []) as Payment[];
}
export async function adminGetFinancial(patientId: string): Promise<Financial | null> {
  if (!supa) return demoLoad().financials.find((f) => f.patient_id === patientId) ?? null;
  const { data } = await supa.from('patient_financials').select('*').eq('patient_id', patientId).limit(1);
  return (data?.[0] as Financial) ?? null;
}

// ─── لوحة الطبيب: كتابة ───
export async function adminSetAppointmentStatus(id: string, status: Appointment['status']): Promise<boolean> {
  if (!supa) {
    const db = demoLoad();
    const a = db.appointments.find((x) => x.id === id);
    if (!a) return false;
    a.status = status; demoSave(db); return true;
  }
  // تغيير الحالة يديره الطبيب — يمر عبر UPDATE (RLS: الطاقم فقط بعد تفعيل Auth)
  const { error } = await supa.from('appointments').update({ status }).eq('id', id);
  return !error;
}
export async function adminSetWaitingStatus(id: string, status: WaitingEntry['status']): Promise<boolean> {
  if (!supa) {
    const db = demoLoad();
    const w = db.waiting.find((x) => x.id === id);
    if (!w) return false;
    w.status = status; demoSave(db); return true;
  }
  const { error } = await supa.from('waiting_list').update({ status }).eq('id', id);
  return !error;
}
export async function adminSetFeedbackStatus(id: string, status: Feedback['status']): Promise<boolean> {
  if (!supa) {
    const db = demoLoad();
    const f = db.feedback.find((x) => x.id === id);
    if (!f) return false;
    f.status = status; demoSave(db); return true;
  }
  const { error } = await supa.from('feedback').update({ status }).eq('id', id);
  return !error;
}
export async function adminAddPayment(input: { patient_id: string; amount: number; method: Payment['method']; label?: string }): Promise<boolean> {
  if (!supa) {
    const db = demoLoad();
    db.payments.unshift({ id: uid(), created_at: new Date().toISOString(), ...input });
    const f = db.financials.find((x) => x.patient_id === input.patient_id);
    if (f) f.amount_paid += input.amount;
    else db.financials.push({ patient_id: input.patient_id, total_cost: input.amount, amount_paid: input.amount });
    demoSave(db); return true;
  }
  const { error } = await supa.from('payments').insert(input);
  if (error) return false;
  const fin = await adminGetFinancial(input.patient_id);
  if (fin) {
    await supa.from('patient_financials').update({ amount_paid: Number(fin.amount_paid) + input.amount }).eq('patient_id', input.patient_id);
  } else {
    await supa.from('patient_financials').insert({ patient_id: input.patient_id, total_cost: input.amount, amount_paid: input.amount });
  }
  return true;
}
export async function adminSaveFinancial(fin: Financial): Promise<boolean> {
  if (!supa) {
    const db = demoLoad();
    const i = db.financials.findIndex((x) => x.patient_id === fin.patient_id);
    if (i >= 0) db.financials[i] = fin; else db.financials.push(fin);
    demoSave(db); return true;
  }
  const { error } = await supa.from('patient_financials').upsert(
    { patient_id: fin.patient_id, total_cost: fin.total_cost, amount_paid: fin.amount_paid, notes: fin.notes },
    { onConflict: 'patient_id' },
  );
  return !error;
}
export async function adminAddPlanItem(input: Omit<PlanItem, 'id'>): Promise<boolean> {
  if (!supa) {
    const db = demoLoad();
    db.plans.push({ id: uid(), ...input });
    demoSave(db); return true;
  }
  const { error } = await supa.from('patient_services').insert(input);
  return !error;
}
export async function adminSetPlanStatus(id: string, status: PlanItem['status']): Promise<boolean> {
  if (!supa) {
    const db = demoLoad();
    const p = db.plans.find((x) => x.id === id);
    if (!p) return false;
    p.status = status;
    if (status === 'completed') p.completed_date = toYMD(new Date());
    demoSave(db); return true;
  }
  const patch: Partial<PlanItem> = { status };
  if (status === 'completed') patch.completed_date = toYMD(new Date());
  const { error } = await supa.from('patient_services').update(patch).eq('id', id);
  return !error;
}
export async function adminCreatePatient(input: { full_name: string; phone: string }): Promise<Patient | null> {
  if (!supa) {
    const db = demoLoad();
    const found = db.patients.find((p) => p.phone === input.phone);
    if (found) return found;
    const p: Patient = { id: uid(), patient_code: `P${String(db.patients.length + 1).padStart(6, '0')}`, ...input };
    db.patients.push(p);
    demoSave(db);
    return p;
  }
  const { data, error } = await supa.from('patients').insert(input).select('*').single();
  return error ? null : (data as Patient);
}
export async function adminCreateAppointment(input: { patient_id: string; service_code: string; appt_date: string; appt_time: string; notes?: string }): Promise<boolean> {  if (!supa) {
    const db = demoLoad();
    db.appointments.push({ id: uid(), status: 'confirmed', source: 'clinic', ...input });
    demoSave(db); return true;
  }
  const { data, error } = await supa.from('appointments').insert({ ...input, source: 'clinic', status: 'pending' }).select('id').single();
  if (error || !data) return false;
  // الطبيب يؤكد مباشرة (التجاوز هنا مقصود: يتم من اللوحة فقط)
  await supa.from('appointments').update({ status: 'confirmed' }).eq('id', data.id);
  return true;
}
