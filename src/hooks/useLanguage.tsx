import { createContext, useContext, useState, ReactNode } from 'react';
import { Language, translations, TranslationKey } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const normalizeLanguage = (raw: string | null): Language => {
    // Backwards-compat: older versions may have stored "pt-PT".
    if (raw === "pt-PT") return "pt";
    if (raw === "en") return "en";
    return "pt";
  };

  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("fleet_language");
    return normalizeLanguage(stored);
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("fleet_language", lang);
  };

  const t = (key: TranslationKey): string => {
    // Safety fallback to avoid blank screens if language storage gets corrupted.
    return translations[language]?.[key] ?? translations.pt[key] ?? String(key);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
