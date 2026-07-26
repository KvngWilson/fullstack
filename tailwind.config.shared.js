const defaultTheme = require('tailwindcss/defaultTheme');

const sharedConfig = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './src/styles/**/*.{css,scss}',
    './views/**/*.{ejs,html}',
    './components/**/*.{ejs,html}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-brand': 'var(--color-primary-brand)',
        accent: 'var(--color-accent)',
        'secondary-brand': 'var(--color-secondary-brand)',
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        pending: 'var(--color-pending)',
        muted: 'var(--color-muted)',
        surface: 'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        border: 'var(--color-border)',
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui'],
        heading: ['Outfit', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0,0,0,0.05)',
        card: '0 4px 12px rgba(0,0,0,0.06)',
      },
      screens: {
        xs: '480px',
      },
    },
  },
};

module.exports = sharedConfig;