/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy:  { DEFAULT: '#1A1A2E', light: '#2A2A4E' },
        gold:  { DEFAULT: '#C9A84C', light: '#D9B86C', dark: '#A8883C' },
        arena: { DEFAULT: '#F0EBE0', dark: '#DDD7CC' },
        stone: { DEFAULT: '#5C5248', light: '#7C726E' },
        // Tokens dependientes del tema (claro/oscuro) — ver variables CSS en index.css
        page:         'rgb(var(--color-page) / <alpha-value>)',
        surface:      'rgb(var(--color-surface) / <alpha-value>)',
        'surface-alt':'rgb(var(--color-surface-alt) / <alpha-value>)',
        ink:          'rgb(var(--color-ink) / <alpha-value>)',
        'ink-soft':   'rgb(var(--color-ink-soft) / <alpha-value>)',
        edge:         'rgb(var(--color-edge) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
