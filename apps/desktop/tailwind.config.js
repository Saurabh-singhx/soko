/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      letterSpacing: {
        tighter: '-0.03em',
        tight: '-0.015em',
        normal: '0em',
        wide: '0.025em',
        wider: '0.05em',
      },
      colors: {
        // Linear.app Design System Palette
        linear: {
          bg: '#08090A',           // Linear canonical dark canvas
          surface: '#121417',      // Primary card surface
          'surface-hover': '#1B1E24',
          'surface-active': '#22262E',
          subtle: 'rgba(255, 255, 255, 0.04)',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-hover': 'rgba(255, 255, 255, 0.16)',
          'border-active': 'rgba(255, 255, 255, 0.24)',

          // Linear Signature Accents
          brand: '#5E6AD2',        // Linear Blurple
          'brand-hover': '#6875E8',
          'brand-subtle': 'rgba(94, 106, 210, 0.15)',

          // Linear Functional State Colors
          cyan: '#56B6F7',
          amber: '#F59E0B',
          green: '#34D399',
          red: '#F87171',

          // Typography Hierarchy
          text: {
            primary: '#F7F8F8',    // 96% contrast
            secondary: '#8A8F98',  // Desaturated cool slate
            tertiary: '#5C616B',   // Muted
            disabled: '#43474F',
          },
        },
      },
      borderRadius: {
        pill: '9999px',
        island: '24px',
        linear: '8px',
        'linear-lg': '12px',
      },
      boxShadow: {
        // Linear hairline & elevation shadows
        'hairline': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        'linear-card': '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        'linear-island': '0 12px 36px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        'linear-glow': '0 0 24px rgba(94, 106, 210, 0.25)',
      },
    },
  },
  plugins: [],
}
