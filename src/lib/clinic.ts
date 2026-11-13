// ─── عيادة أحمد وضاح — الثوابت المركزية ───
// أي تغيير هنا (هاتف/أوقات/خدمات) ينعكس على الموقع كامل + لوحة الطبيب

export const CLINIC = {
  doctorShort: 'Dr Ahmed Ouadah',
  phoneIntl: '+213553259607',
  phoneDisplay: '+213 553 25 96 07',
  phoneDisplayShort: '0553 25 96 07',
  whatsapp: 'https://wa.me/213553259607',
  mapsUrl: 'https://maps.app.goo.gl/zTKF3dsUTG6SaYhj6',
  mapsEmbed: 'https://www.google.com/maps?q=Sidi+Bel+Abbes,+Algeria&z=13&output=embed',
  city: 'Sidi Bel Abbès',
  // الأحد=0 ... الخميس=4 (JS: الأحد=0، الخميس=4، الجمعة=5، السبت=6)
  workDays: [0, 1, 2, 3, 4],
  workStart: '08:00',
  workEnd: '17:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  slotMinutes: 30,
} as const;

// معرفات الخدمات الـ11 + أخرى — تطابق careTypes في translations.ts وأعمدة service_code في Supabase
export const SERVICE_IDS = [
  'root-canal',
  'ortho',
  'implants',
  'hollywood',
  'crowns',
  'fillings',
  'whitening',
  'kids',
  'gum',
  'surgery',
  'sedation',
  'other',
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];

export function isWorkDay(date: Date): boolean {
  return CLINIC.workDays.includes(date.getDay() as 0 | 1 | 2 | 3 | 4);
}

export function buildTimeSlots(): string[] {
  const slots: string[] = [];
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const start = toMin(CLINIC.workStart);
  const end = toMin(CLINIC.workEnd);
  const lunchS = toMin(CLINIC.lunchStart);
  const lunchE = toMin(CLINIC.lunchEnd);
  for (let cur = start; cur + CLINIC.slotMinutes <= end; cur += CLINIC.slotMinutes) {
    if (cur >= lunchS && cur < lunchE) continue;
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

export const TIME_SLOTS = buildTimeSlots();

/** هاتف جزائري: يبدأ بـ 05/06/07 ومجموع 10 أرقام */
export function validDZPhone(raw: string): boolean {
  const p = raw.replace(/[\s-]/g, '');
  return /^0(5|6|7)\d{8}$/.test(p);
}

export function normalizeDZPhone(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
