import { useState, useEffect } from 'react';
import Hero from './components/Hero';
import ChatAssistant from './ChatAssistant';
import { translations } from './translations';
import type { Language } from './translations';
import { Toaster } from './components/ui/sonner';

export default function App() {
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
    <>
      <Hero lang={lang} toggleLang={toggleLang} t={t} />
      <ChatAssistant lang={lang} t={t} />
      <Toaster theme="light" />
    </>
  );
}
