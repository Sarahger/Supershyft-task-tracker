/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#191919',
          sidebar: '#202020',
          card: '#252525',
          drawer: '#262626',
          hover: '#2a2a2a',
          border: '#323232',
          muted: '#2f2f2f',
        },
        text: {
          primary: '#F5F5F5',
          secondary: '#A1A1AA',
          muted: '#71717A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      transitionDuration: {
        drawer: '250ms',
        hover: '100ms',
        dropdown: '150ms',
        status: '200ms',
      },
      maxWidth: {
        workspace: '1200px',
      },
      animation: {
        'slide-in': 'slideIn 250ms ease-out',
      },
      keyframes: {
        slideIn: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
