import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import es from './locales/es.json'
import en from './locales/en.json'
import uk from './locales/uk.json'
import ro from './locales/ro.json'
import ar from './locales/ar.json'
import pt from './locales/pt.json'
import zh from './locales/zh.json'

// Idiomas soportados. La bandera "rtl" se usa para ajustar la dirección
// del documento (árabe se escribe de derecha a izquierda).
export const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'ro', label: 'Română', flag: '🇷🇴' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
]

export function applyDocumentDirection(lng) {
  const isRtl = LANGUAGES.find(l => l.code === lng)?.rtl
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
  document.documentElement.lang = lng
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      uk: { translation: uk },
      ro: { translation: ro },
      ar: { translation: ar },
      pt: { translation: pt },
      zh: { translation: zh },
    },
    fallbackLng: 'es',
    supportedLngs: LANGUAGES.map(l => l.code),
    detection: {
      // Prioriza lo que el usuario eligió a mano (localStorage) sobre el
      // idioma del navegador, para que la elección persista entre sesiones.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'xander_idioma',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

applyDocumentDirection(i18n.resolvedLanguage || i18n.language)
i18n.on('languageChanged', applyDocumentDirection)

export default i18n
