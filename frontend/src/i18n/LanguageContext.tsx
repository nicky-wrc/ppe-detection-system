import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Language = 'th' | 'en'

const LANGUAGE_STORAGE_KEY = 'ppe-language'

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  text: (thai: string, english: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => (
    localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'th'
  ))

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    text: (thai, english) => language === 'th' ? thai : english,
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// The provider and its hook intentionally share this small module.
// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
