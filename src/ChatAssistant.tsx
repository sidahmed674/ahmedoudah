import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import type { Language } from './translations';

interface Props {
  lang: Language;
  t: any;
}

interface Msg { me: boolean; html: string }

const BOOK_LINK = '<a href="#reservation" style="color:#5E876C;font-weight:800;text-decoration:underline">✓</a>';

function localAnswer(q: string): string | null {
  const s = q.toLowerCase();
  const has = (...ws: string[]) => ws.some((x) => s.includes(x));
  if (has('زراع', 'implant', 'غرس')) return 'الزراعة بين <b>45,000 و70,000 دج</b> حسب الحالة وبالتقسيط. ' + BOOK_LINK;
  if (has('تقويم', 'ortho', 'appareil', 'braces')) return 'التقويم يبدأ من <b>60,000 دج</b> ويتقسط على مدة العلاج. ' + BOOK_LINK;
  if (has('تبييض', 'blanch', 'whiten')) return 'التبييض بالليزر <b>12,000–20,000 دج</b>، جلسة واحدة بدون حساسية ✨ ' + BOOK_LINK;
  if (has('زيركون', 'zircone', 'crown', 'couronne', 'تاج', 'تركيب')) return 'تاج الزيركون <b>12,000–25,000 دج</b>، طبيعي 100%. ' + BOOK_LINK;
  if (has('هوليود', 'hollywood', 'facette', 'فينير', 'قشور')) return 'ابتسامة هوليود تُدرس حالة بحالة — احجز فحصا أوليا والطبيب يعطيك خطة وسعرا ثابتا. ' + BOOK_LINK;
  if (has('جذر', 'عصب', 'canal', 'devital')) return 'علاج الجذور <b>بدون ألم في جلسة واحدة</b> بتشخيص رقمي. ' + BOOK_LINK;
  if (has('خلع', 'ضرس العقل', 'sagesse', 'extract', 'جراح')) return 'خلع ضرس العقل المدفون وجراحة الفم متوفرة. ' + BOOK_LINK;
  if (has('اطفال', 'أطفال', 'enfant', 'kids', 'صغار')) return 'نستقبل الأطفال بعناية لطيفة، مع إمكانية التخدير الكلي للقلقين 👶 ' + BOOK_LINK;
  if (has('سعر', 'شحال', 'prix', 'tarif', 'price', 'combien', 'بشحال')) return 'تنظيف <b>3,000+</b> • حشوة <b>3,000+</b> • تبييض <b>12,000+</b> • زراعة <b>45,000+</b> • تقويم <b>60,000+</b> دج. واش تحب تفاصيل خدمة معينة؟';
  if (has('وين', 'عنوان', 'adresse', 'address', 'where', 'موقع', 'où', 'ou ')) return 'رانا في <b>سيدي بلعباس، الجزائر</b> 📍 <a href="https://maps.app.goo.gl/zTKF3dsUTG6SaYhj6" target="_blank" style="color:#5E876C;font-weight:800;text-decoration:underline">الاتجاهات</a>';
  if (has('جمعة', 'vendredi', 'سبت', 'samedi', 'وقت', 'horaire', 'hours', 'مفتوح', 'ouvert', 'تخدم', 'ouverture')) return 'نخدمو <b>الأحد – الخميس 08:00 – 17:00</b>. الجمعة والسبت مغلق.';
  if (has('خايف', 'peur', 'خوف', 'ألم', 'douleur', 'توجع', 'scared', 'pain', 'يوجع')) return 'ما تخافش 😌 أغلب مرضانا كانوا خايفين: علاج <b>بدون ألم</b> وشرح كل خطوة. احجز وخلي الباقي علينا. ' + BOOK_LINK;
  if (has('حجز', 'rdv', 'rendez', 'موعد', 'book', 'نحجز', 'appointment')) return 'الحجز ساهل: اختر <b>العلاج واليوم والوقت</b>، دخل رقم هاتفك، صايي ✓ ' + BOOK_LINK;
  if (has('خلص', 'دفع', 'paiement', 'pay', 'ccp', 'كاش', 'espece', 'تسبيق')) return 'الحجز <b>مجاني</b>. الدفع في العيادة (نقدا/CCP)، والعلاجات الغالية <b>بالتقسيط</b>.';
  if (has('انتظار', 'attente', 'queue', 'قائمة')) return 'ما لقيتش وقت؟ سجل في <b>قائمة الانتظار</b> في قسمها ونعيطولك كي يتحرر موعد.';
  if (has('سلام', 'salut', 'bonjour', 'صباح', 'مساء', 'azul', 'hello', 'salam', 'cc ')) return 'وعليكم السلام 🌸 مرحبا بيك! سقسيني على الأسعار ولا الحجز وأنا نعاونك.';
  if (has('شكرا', 'merci', 'thanks', 'صحيت')) return 'العفو، بلا مزية 😊 ومرحبا بيك في أي وقت!';
  if (has('طبيب', 'docteur', 'doctor', 'وضاح', 'ouadah', 'شكون')) return 'الدكتور <b>أحمد وضاح</b> — طبيب جراح أسنان، زراعة وتجميل، +10 سنوات خبرة في سيدي بلعباس 🦷';
  return null;
}

async function geminiAnswer(q: string, lang: Language): Promise<string | null> {
  const key = import.meta.env.VITE_GEMINI_KEY as string | undefined;
  if (!key) {
    console.warn('[assistant] VITE_GEMINI_KEY missing — restart dev server after adding .env');
    return null;
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: `Tu es l'assistant de la clinique dentaire du Dr Ahmed Ouadah à Sidi Bel Abbès (Algérie). Langue: ${lang}. Infos: Dim-Jeu 08:00-17:00, fermé Ven-Sam, tél +213553259607, paiement à la clinique, implants 45000-70000 DA, orthodontie dès 60000 DA, blanchiment laser 12000-20000 DA. Réponds court (2-3 phrases), en darija algérienne si arabe. Pour un diagnostic, renvoie vers une consultation.` }] },
          contents: [{ parts: [{ text: q }] }],
        }),
      },
    );
    const j = await res.json();
    if (!res.ok) {
      console.warn('[assistant] Gemini API error:', j?.error?.message ?? res.status);
      return null;
    }
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    return text ? text.slice(0, 600) : null;
  } catch (e) {
    console.warn('[assistant] Gemini fetch failed:', e);
    return null;
  }
}

export default function ChatAssistant({ lang, t }: Props) {
  const a = t.assistant;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, typing, open]);

  function toggle() {
    setOpen((o) => !o);
    if (!opened.current) {
      opened.current = true;
      setMsgs([{ me: false, html: a.welcome }]);
    }
  }

  async function ask(q: string, lang: Language) {
    const clean = q.trim();
    if (!clean || typing) return;
    setMsgs((m) => [...m, { me: true, html: clean }]);
    setInput('');
    setTyping(true);
    const local = localAnswer(clean);
    if (local) {
      setTimeout(() => { setMsgs((m) => [...m, { me: false, html: local }]); setTyping(false); }, 450);
      return;
    }
    const g = await geminiAnswer(clean, lang);
    setMsgs((m) => [...m, { me: false, html: g ?? a.fallback ?? 'سؤال وجيه 🤔 هذي تحتاج رأي الطبيب — احجز فحصا أوليا. <a href="#reservation" style="color:#5E876C;font-weight:800;text-decoration:underline">احجز هنا</a>' }]);
    setTyping(false);
  }

  return (
    <>
      <button onClick={toggle} aria-label="assistant"
        className="fixed bottom-5 left-5 z-[999] w-14 h-14 rounded-full bg-[#253F31] text-white shadow-2xl hover:scale-105 transition-transform flex items-center justify-center">
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
            className="fixed bottom-24 left-4 z-[999] w-[330px] max-w-[calc(100vw-2rem)] rounded-[1.8rem] overflow-hidden bg-white border border-black/10 shadow-2xl flex flex-col">
            <div className="bg-[#253F31] text-white px-4 py-3">
              <div className="text-sm font-bold flex items-center gap-2">
                {a.title}
                <span className="flex items-center gap-1 text-[11px] text-emerald-300"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />{a.online}</span>
              </div>
              <div className="text-[11px] text-white/60">{a.subtitle}</div>
            </div>
            <div ref={boxRef} className="h-72 overflow-y-auto p-3 space-y-2 bg-[#f0f0f0] text-[13px]">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.me ? 'justify-start flex-row-reverse' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl leading-relaxed ${m.me ? 'bg-[#253F31] text-white' : 'bg-white border border-black/5'}`}
                    dangerouslySetInnerHTML={{ __html: m.html }} />
                </div>
              ))}
              {typing && <div className="text-xs text-black/40">…</div>}
            </div>
            <div className="p-2 border-t border-black/5">
              <div className="flex flex-wrap gap-1.5 px-1 pb-2">
                {a.chips.map((c: string) => (
                  <button key={c} onClick={() => ask(c, lang)}
                    className="text-[11px] font-bold bg-[rgba(94,135,108,0.08)] border border-[rgba(94,135,108,0.2)] px-2.5 py-1 rounded-full hover:bg-[rgba(94,135,108,0.15)]">{c}</button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); ask(input, lang); }} className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={a.placeholder}
                  className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[rgba(94,135,108,0.6)]" />
                <button type="submit" className="bg-[#253F31] text-white px-4 rounded-xl font-bold">←</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
