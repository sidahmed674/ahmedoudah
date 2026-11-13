import { translations, type Language } from '../translations';
import { STATUS_COLORS, adminT, type AdminLang } from './adminI18n';

export function svcLabel(code: string, lang: AdminLang): string {
  const map = translations[lang as Language]?.reservation?.careTypes as Record<string, string> | undefined;
  return map?.[code] ?? code;
}

export function StatusPill({ status, lang }: { status: string; lang: AdminLang }) {
  const label = (adminT[lang].status as Record<string, string>)[status] ?? status;
  return (
    <span className={`inline-block text-[11px] font-bold border rounded-full px-2.5 py-0.5 ${STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {label}
    </span>
  );
}

export function PlanPill({ status, lang }: { status: string; lang: AdminLang }) {
  const label = (adminT[lang].planStatus as Record<string, string>)[status] ?? status;
  const color = status === 'completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : status === 'in_progress' ? 'bg-sky-100 text-sky-800 border-sky-200'
    : status === 'cancelled' ? 'bg-rose-100 text-rose-700 border-rose-200'
    : 'bg-amber-100 text-amber-800 border-amber-200';
  return (
    <span className={`inline-block text-[11px] font-bold border rounded-full px-2.5 py-0.5 ${color}`}>{label}</span>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-3xl border border-black/5 shadow-sm ${className}`}>{children}</div>;
}

export function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('');
}

export const fmtDZD = (n: number | string) =>
  `${Number(n || 0).toLocaleString('fr-FR')} DA`;
