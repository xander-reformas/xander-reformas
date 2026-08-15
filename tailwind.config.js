/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy:  { DEFAULT: '#1A1A2E', light: '#2A2A4E' },
        gold:  { DEFAULT: '#C9A84C', light: '#D9B86C', dark: '#A8883C' },
        arena: { DEFAULT: '#F0EBE0', dark: '#DDD7CC' },
        stone: { DEFAULT: '#5C5248', light: '#7C726E' },
      },
      fontFamily: {
        sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
