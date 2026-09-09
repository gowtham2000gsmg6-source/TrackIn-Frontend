/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F1720',
        slate: {
          950: '#0B1220',
        },
        brass: {
          50: '#FBF7EF',
          100: '#F3E9D2',
          400: '#C9A24B',
          500: '#B08A2E',
          600: '#8F6E20',
        },
        signal: {
          green: '#2E7D5B',
          amber: '#B0791E',
          red: '#B0392E',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
