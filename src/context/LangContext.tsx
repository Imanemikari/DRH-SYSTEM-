import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, translations } from '../utils/translations';

interface LangContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
  tArray: (key: string) => string[];
  dir: 'ltr' | 'rtl';
}

const LangContext = createContext<LangContextType>({
  lang: 'fr',
  setLang: () => {},
  t: (key: string) => key,
  tArray: () => [],
  dir: 'ltr',
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('drh_lang') as Language) || 'fr';
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem('drh_lang', l);
  };

  const t = (key: string): string => {
    const val = translations[lang]?.[key] ?? translations.fr[key] ?? key;
    return Array.isArray(val) ? val.join(', ') : val;
  };

  const tArray = (key: string): string[] => {
    const val = translations[lang]?.[key] ?? translations.fr[key] ?? [];
    return Array.isArray(val) ? val : [];
  };

  const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    document.body.style.direction = dir;
    document.body.style.textAlign = dir === 'rtl' ? 'right' : 'left';
  }, [lang, dir]);

  return (
    <LangContext.Provider value={{ lang, setLang, t, tArray, dir }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
