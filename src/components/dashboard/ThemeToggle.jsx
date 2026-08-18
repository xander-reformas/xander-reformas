import { useTheme } from '../../hooks/useTheme'

export default function ThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={`relative flex items-center rounded-full transition-colors ${
        compact ? 'w-9 h-9 justify-center' : 'w-14 h-8 px-1'
      } ${isDark ? 'bg-navy' : 'bg-edge'}`}
    >
      {compact ? (
        <span className="text-base leading-none">{isDark ? '🌙' : '☀️'}</span>
      ) : (
        <span
          className={`w-6 h-6 rounded-full bg-surface shadow flex items-center justify-center text-xs transition-transform ${
            isDark ? 'translate-x-6' : 'translate-x-0'
          }`}
        >
          {isDark ? '🌙' : '☀️'}
        </span>
      )}
    </button>
  )
}
