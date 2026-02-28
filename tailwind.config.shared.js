/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./client/src/**/*.{js,jsx,tsx}",
    "./server/views/**/*.ejs",
    "./server/public/**/*.{js,html}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#22c55e",
          brand: "#16a34a",
          light: "#86efac",
        },
        accent: "#e8f5ee",
        "secondary-brand": "#0f766e",
        success: "#16a34a",
        error: "#dc2626",
        pending: "#f59e0b",
        muted: "#94a3b8",
      },
      fontFamily: {
        sans: ['"Poppins"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-1': ['2.25rem', { lineHeight: '1.2', fontWeight: '700' }],
        'display-2': ['2rem', { lineHeight: '1.2', fontWeight: '700' }],
        'header-1': ['2rem', { lineHeight: '1.25', fontWeight: '600' }],
        'header-2': ['1.5rem', { lineHeight: '1.33', fontWeight: '600' }],
        'header-3': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['0.95rem', { lineHeight: '1.5', fontWeight: '400' }],
        'label': ['0.875rem', { lineHeight: '1.5', fontWeight: '500' }],
        'caption': ['0.75rem', { lineHeight: '1.5', fontWeight: '500' }],
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '2.5rem',
      },
      borderRadius: {
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
};
