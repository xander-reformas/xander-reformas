import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../../i18n'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = LANGUAGES.find(l => l.code === i18n.resolvedLanguage) || LANGUAGES[0]

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function elegir(code) {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        title={t('common.language')}
        className="w-9 h-9 rounded-full flex items-center justify-center text-base hover:bg-edge transition-colors"
      >
        {current.flag}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-surface border border-edge rounded-xl shadow-lg py-1.5 z-50">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => elegir(l.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors ${
                l.code === current.code ? 'text-gold-dark font-semibold bg-gold/10' : 'text-ink hover:bg-page'
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
