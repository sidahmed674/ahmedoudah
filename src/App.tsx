import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Hero from './components/Hero';
import ChatAssistant from './ChatAssistant';
import AdminApp from './admin/AdminApp';
import { translations } from './translations';
import type { Language } from './translations';
import { Toaster } from './components/ui/sonner';

import { ThemeProvider } from 'next-themes';

function Site() {
  const [lang, setLang] = useState<Language>('ar');
  const t = translations[lang];

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.title = t.title;
  }, [lang, t.title]);

  const toggleLang = () => {
    const langs: Language[] = ['ar', 'fr', 'en'];
    const next = langs[(langs.indexOf(lang) + 1) % langs.length];
    setLang(next);
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <Hero lang={lang} toggleLang={toggleLang} t={t} />
      <ChatAssistant lang={lang} t={t} />
      <Toaster />
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Site />} />
      </Routes>
    </HashRouter>
  );
}
