import { useState } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, Users, ClipboardList, Wallet, BellRing, Star, LogOut, Globe, Stethoscope,
} from 'lucide-react';
import { adminT, type AdminLang } from './adminI18n';
import { isCloud } from '../lib/supabase';
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Patients from './pages/Patients';
import Plans from './pages/Plans';
import Finances from './pages/Finances';
import Waiting from './pages/Waiting';
import Reviews from './pages/Reviews';

const PIN = (import.meta.env.VITE_ADMIN_PIN as string | undefined) || '1234';

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('ouadah_admin') === '1');
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [lang, setLang] = useState<AdminLang>('ar');
  const t = adminT[lang];
  const rtl = lang === 'ar';
  const nav = useNavigate();
  const loc = useLocation();

  if (!authed) {
    return (
      <div dir={rtl ? 'rtl' : 'ltr'} className="min-h-screen bg-[#faf9f7] flex items-center justify-center p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin === PIN) { sessionStorage.setItem('ouadah_admin', '1'); setAuthed(true); }
            else setWrong(true);
          }}
          className="w-full max-w-sm bg-white rounded-3xl border border-black/5 shadow-xl p-8 text-center"
        >
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#253F31] flex items-center justify-center">
            <Stethoscope className="w-7 h-7 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">{t.loginTitle}</h1>
          <p className="text-xs text-slate-500 mt-1">{t.clinic} • Sidi Bel Abbès</p>
          <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric"
            placeholder={t.loginPin} dir="ltr"
            className="mt-6 w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-xl tracking-[0.5em] outline-none focus:border-[#253F31]" />
          {wrong && <p className="mt-2 text-xs font-bold text-rose-600">{t.loginWrong}</p>}
          <button className="mt-4 w-full rounded-2xl bg-[#253F31] text-white py-3 text-sm font-bold hover:bg-black">{t.loginBtn}</button>
          <div className="mt-4 flex justify-center gap-1">
            {(['ar', 'fr', 'en'] as AdminLang[]).map((l) => (
              <button type="button" key={l} onClick={() => setLang(l)}
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${lang === l ? 'bg-[#253F31] text-white' : 'text-slate-400'}`}>{l}</button>
            ))}
          </div>
        </form>
      </div>
    );
  }

  const items = [
    { to: '', label: t.menu.home, icon: LayoutDashboard },
    { to: 'agenda', label: t.menu.agenda, icon: CalendarDays },
    { to: 'patients', label: t.menu.patients, icon: Users },
    { to: 'plans', label: t.menu.plans, icon: ClipboardList },
    { to: 'finances', label: t.menu.finances, icon: Wallet },
    { to: 'waiting', label: t.menu.waiting, icon: BellRing },
    { to: 'reviews', label: t.menu.reviews, icon: Star },
  ];

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="min-h-screen bg-[#faf9f7] text-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 hidden md:flex flex-col bg-white border-e border-black/5 min-h-screen sticky top-0 h-screen">
        <div className="p-5 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#253F31] flex items-center justify-center">
            <img src="/images/logo.svg" alt="logo" className="w-7 h-7" />
          </div>
          <div>
            <div className="font-bold text-sm">Ouadah Clinic</div>
            <div className="text-[11px] text-slate-400">Sidi Bel Abbès</div>
          </div>
        </div>
        <nav className="px-3 space-y-1 flex-1">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === ''}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-colors ${isActive ? 'bg-[#EEF4F0] text-[#253F31] font-bold' : 'text-slate-500 hover:bg-slate-100'}`}>
              <it.icon className="w-[18px] h-[18px]" /> {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4">
          <div className="rounded-2xl bg-slate-50 border border-black/5 p-3.5 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#253F31] text-white flex items-center justify-center text-sm font-bold">A</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate">Dr Ahmed Ouadah</div>
              <div className={`text-[10px] font-bold ${isCloud ? 'text-emerald-600' : 'text-amber-600'}`}>{isCloud ? t.cloudMode : t.demoMode}</div>
            </div>
            <button title={t.logout} onClick={() => { sessionStorage.removeItem('ouadah_admin'); setAuthed(false); nav('/'); }}
              className="text-slate-400 hover:text-rose-600"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-[#faf9f7]/90 backdrop-blur border-b border-black/5 px-4 sm:px-6 py-3 flex items-center gap-3">
          <span className="font-bold text-sm">{t.clinic}</span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${isCloud ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {isCloud ? t.cloudMode : t.demoMode}
          </span>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-slate-500">
            <Globe className="w-3.5 h-3.5" />
            {(['ar', 'fr', 'en'] as AdminLang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`px-2 py-1 rounded-lg uppercase ${lang === l ? 'bg-[#253F31] text-white' : ''}`}>{l}</button>
            ))}
          </div>
          <a href="#/" className="text-xs font-bold text-slate-500 hover:text-slate-900 border border-black/10 rounded-xl px-3 py-1.5">{t.backToSite}</a>
        </header>

        {/* Mobile nav */}
        <nav className="md:hidden flex gap-1.5 overflow-x-auto px-3 py-2.5 bg-white border-b border-black/5">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === ''}
              className={({ isActive }) => `flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${isActive ? 'bg-[#253F31] text-white' : 'bg-slate-100 text-slate-600'}`}>
              <it.icon className="w-3.5 h-3.5" /> {it.label}
            </NavLink>
          ))}
        </nav>

        <main className="p-4 sm:p-6 max-w-6xl mx-auto" key={loc.pathname + lang}>
          <Routes>
            <Route index element={<Dashboard lang={lang} />} />
            <Route path="agenda" element={<Agenda lang={lang} />} />
            <Route path="patients" element={<Patients lang={lang} />} />
            <Route path="plans" element={<Plans lang={lang} />} />
            <Route path="finances" element={<Finances lang={lang} />} />
            <Route path="waiting" element={<Waiting lang={lang} />} />
            <Route path="reviews" element={<Reviews lang={lang} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
