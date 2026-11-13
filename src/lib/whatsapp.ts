// ─── روابط واتساب برسائل جاهزة (نمط hardik: wa.me) ───
import { CLINIC } from './clinic';

function wa(text: string): string {
  return `${CLINIC.whatsapp}?text=${encodeURIComponent(text)}`;
}

/** رسالة تأكيد موعد — تُفتح من لوحة الطبيب */
export function waConfirm(patientName: string, service: string, date: string, time: string): string {
  return wa(
    `سلام ${patientName} 🌸 عيادة الدكتور أحمد وضاح تذكرك: موعدك (${service}) يوم ${date} على الساعة ${time}. المرجو الحضور قبل الموعد بـ 10 دقائق. سيدي بلعباس 📍`,
  );
}

/** تذكير قبل 24 ساعة */
export function waRemind(patientName: string, service: string, date: string, time: string): string {
  return wa(
    `تذكير ⏰ ${patientName}: عندك موعد غدا (${service}) يوم ${date} على ${time} في عيادة الدكتور أحمد وضاح. للتأكيد أو التأجيل رد علينا هنا.`,
  );
}

/** تبليغ قائمة الانتظار بموعد تحرر */
export function waWaitingSlot(service: string, date: string, time: string): string {
  return wa(
    `خبر سار 🎉 تحرر موعد (${service}) يوم ${date} على ${time}. أول من يرد يحجز الموعد. عيادة الدكتور أحمد وضاح.`,
  );
}

/** مشاركة ملف/فاتورة المريض */
export function waFile(patientName: string, label: string): string {
  return wa(`سلام ${patientName}، هذا ملفك (${label}) من عيادة الدكتور أحمد وضاح 📄`);
}

/** زر واتساب عام للموقع */
export function waGeneral(): string {
  return wa('سلام عليكم، حاب نحجز موعد في عيادة الدكتور أحمد وضاح 🦷');
}
