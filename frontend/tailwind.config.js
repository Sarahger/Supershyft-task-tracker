/** @type {import('tailwindcss').Config} */

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: 'rgb(var(--color-bg-rgb) / <alpha-value>)',
          sidebar: 'rgb(var(--color-sidebar-rgb) / <alpha-value>)',
          card: 'rgb(var(--color-card-rgb) / <alpha-value>)',
          drawer: 'rgb(var(--color-drawer-rgb) / <alpha-value>)',
          hover: 'rgb(var(--color-hover-rgb) / <alpha-value>)',
          border: 'rgb(var(--color-border-rgb) / <alpha-value>)',
          muted: 'rgb(var(--color-muted-rgb) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--color-text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted-rgb) / <alpha-value>)',
        },
        surface: {
          muted: 'var(--surface-muted)',
          subtle: 'var(--surface-subtle)',
          highlight: 'var(--surface-highlight)',
          active: 'var(--surface-active)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          success: 'var(--accent-success)',
          warning: 'var(--accent-warning)',
          danger: 'var(--accent-danger)',
          purple: 'var(--accent-purple)',
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
};
