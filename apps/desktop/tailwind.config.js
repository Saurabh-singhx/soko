/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        island: {
          bg: '#0A0A0C',
          border: 'rgba(255, 255, 255, 0.12)',
          accent: '#00F0FF',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
        }
      },
      borderRadius: {
        'pill': '9999px',
        'island': '28px',
      },
      boxShadow: {
        'island-glow': '0 8px 32px 0 rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(255, 255, 255, 0.15)',
        'mascot-glow': '0 0 16px rgba(0, 240, 255, 0.35)',
      }
    },
  },
  plugins: [],
}
