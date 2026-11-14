import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import type { Language, TranslationBundle } from './translations';
import { askClinicAssistant } from './lib/api';

interface Props {
  lang: Language;
  t: TranslationBundle;
}

interface Msg {
  me: boolean;
  html: string;
  plain: string;
}

const BOOK_LINK = '<a href="#reservation" style="color:#5E876C;font-weight:800;text-decoration:underline">✓</a>';

function formatAiTextToHtml(str: string): string {
  const escaped = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  return escaped
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#5E876C;font-weight:700;text-decoration:underline">$1</a>'
    )
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong style="display:block;margin-top:6px">$1</strong>')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06);padding:1px 5px;border-radius:4px">$1</code>')
    .replace(/#reservation/g, '<a href="#reservation" style="color:#5E876C;font-weight:800;text-decoration:underline">حجز موعد</a>')
    .replace(/\n/g, '<br/>');
}

function escapeUserHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br/>');
}

function offlineFallbackAnswer(q: string): string | null {
  const s = q.toLowerCase();
  const has = (...ws: string[]) => ws.some((x) => s.includes(x));
  if (has('زراع', 'implant', 'غرس')) return 'الزراعة بين <b>45,000 و70,000 دج</b> حسب الحالة وبالتقسيط. ' + BOOK_LINK;
  if (has('تقويم', 'ortho', 'appareil', 'braces')) return 'التقويم يبدأ من <b>60,000 دج</b> ويتقسط على مدة العلاج. ' + BOOK_LINK;
  if (has('تبييض', 'blanch', 'whiten')) return 'التبييض بالليزر <b>12,000–20,000 دج</b>، جلسة واحدة بدون حساسية ✨ ' + BOOK_LINK;
  if (has('زيركون', 'zircone', 'crown', 'couronne', 'تاج', 'تركيب')) return 'تاج الزيركون <b>12,000–25,000 دج</b>، طبيعي 100%. ' + BOOK_LINK;
  if (has('وين', 'عنوان', 'adresse', 'address', 'where', 'موقع', 'où', 'ou ')) return 'رانا في <b>سيدي بلعباس، الجزائر</b> 📍 <a href="https://maps.app.goo.gl/zTKF3dsUTG6SaYhj6" target="_blank" rel="noopener noreferrer" style="color:#5E876C;font-weight:800;text-decoration:underline">الاتجاهات</a>';
  if (has('جمعة', 'vendredi', 'سبت', 'samedi', 'وقت', 'horaire', 'hours', 'مفتوح', 'ouvert', 'تخدم', 'ouverture')) return 'نخدمو <b>الأحد – الخميس 08:00 – 17:00</b>. الجمعة والسبت مغلق.';
  if (has('حجز', 'rdv', 'rendez', 'موعد', 'book', 'نحجز', 'appointment')) return 'الحجز ساهل: اختر <b>العلاج واليوم والوقت</b>، دخل رقم هاتفك، صايي ✓ ' + BOOK_LINK;
  if (has('طبيب', 'docteur', 'doctor', 'وضاح', 'ouadah', 'شكون')) return 'الدكتور <b>أحمد وضاح</b> — طبيب جراح أسنان، زراعة وتجميل، خبرة تفوق 30 سنة في سيدي بلعباس 🦷';
  return null;
}

function getFallbackHtml(lang: Language): string {
  if (lang === 'fr') {
    return 'Bonne question 🤔 Réessayez dans un instant ou réservez une consultation. <a href="#reservation" style="color:#5E876C;font-weight:800;text-decoration:underline">Réserver ici</a>';
  }
  if (lang === 'en') {
    return 'Great question 🤔 Please try again in a moment or book a consultation. <a href="#reservation" style="color:#5E876C;font-weight:800;text-decoration:underline">Book here</a>';
  }
  return 'تعذر الاتصال مؤقتاً — أعد إرسال سؤالك أو احجز استشارة مباشرة. <a href="#reservation" style="color:#5E876C;font-weight:800;text-decoration:underline">احجز هنا</a>';
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
      setMsgs([{ me: false, html: a.welcome, plain: a.welcome }]);
    }
  }

  async function ask(q: string, activeLang: Language) {
    const clean = q.trim();
    if (!clean || typing) return;
    const history = msgs.slice(-10).map((m) => ({
      role: (m.me ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.plain,
    }));

    setMsgs((m) => [...m, { me: true, html: escapeUserHtml(clean), plain: clean }]);
    setInput('');
    setTyping(true);

    const aiReply = await askClinicAssistant({
      question: clean,
      lang: activeLang,
      history,
    });

    const replyHtml = aiReply
      ? formatAiTextToHtml(aiReply)
      : (offlineFallbackAnswer(clean) ?? getFallbackHtml(activeLang));
    const replyPlain = aiReply ?? replyHtml.replace(/<[^>]+>/g, '');

    setMsgs((m) => [...m, { me: false, html: replyHtml, plain: replyPlain }]);
    setTyping(false);
  }

  return (
    <>
      <button
        onClick={toggle}
        aria-label="assistant"
        className="fixed bottom-5 left-5 z-[999] w-14 h-14 rounded-full bg-[#253F31] text-white shadow-2xl hover:scale-105 transition-transform flex items-center justify-center"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            className="fixed bottom-24 left-4 z-[999] w-[360px] sm:w-[390px] max-w-[calc(100vw-2rem)] rounded-[1.8rem] overflow-hidden bg-white border border-black/10 shadow-2xl flex flex-col"
          >
            <div className="bg-[#253F31] text-white px-4 py-3">
              <div className="text-sm font-bold flex items-center gap-2">
                {a.title}
                <span className="flex items-center gap-1 text-[11px] text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {a.online}
                </span>
              </div>
              <div className="text-[11px] text-white/60">{a.subtitle}</div>
            </div>
            <div ref={boxRef} className="h-80 overflow-y-auto p-3 space-y-2.5 bg-[#f0f0f0] text-[13px]">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.me ? 'justify-start flex-row-reverse' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl leading-relaxed ${m.me ? 'bg-[#253F31] text-white' : 'bg-white border border-black/5 text-slate-800'}`}
                    dangerouslySetInnerHTML={{ __html: m.html }}
                  />
                </div>
              ))}
              {typing && <div className="text-xs text-black/40 px-1">•••</div>}
            </div>
            <div className="p-2 border-t border-black/5">
              <div className="flex flex-wrap gap-1.5 px-1 pb-2">
                {a.chips.map((c: string) => (
                  <button
                    key={c}
                    onClick={() => ask(c, lang)}
                    className="text-[11px] font-bold bg-[rgba(94,135,108,0.08)] border border-[rgba(94,135,108,0.2)] px-2.5 py-1 rounded-full hover:bg-[rgba(94,135,108,0.15)]"
                  >
                    {c}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(input, lang);
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={a.placeholder}
                  className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[rgba(94,135,108,0.6)]"
                />
                <button type="submit" className="bg-[#253F31] text-white px-4 rounded-xl font-bold">
                  ←
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
