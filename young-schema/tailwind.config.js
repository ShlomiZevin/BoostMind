/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          DEFAULT: '#0b0d10',
          card: '#13171c',
          subtle: '#1a1f26',
        },
        border: {
          DEFAULT: '#262b33',
          subtle: '#1f242b',
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
        },
        band: {
          low: '#22c55e',
          medium: '#eab308',
          high: '#f97316',
          veryhigh: '#ef4444',
        },
      },
    },
  },
  plugins: [],
}
