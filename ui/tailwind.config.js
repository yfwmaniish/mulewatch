/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // App Custom Palette
        brand: {
          bg: '#f8fafc',        // Stripe light canvas (Slate-50)
          border: '#e2e8f0',    // Slate-200 border
          surface: '#ffffff',   // White card surface
          lightBg: '#f1f5f9',   // Slate-100 backing
          lightSurface: '#ffffff',
          textPrimary: '#0f172a', // Slate-900
          textSecondary: '#475569', // Slate-600
          sidebar: '#0f172a',   // Deep slate-900 for dark sidebar
          sidebarBorder: '#1e293b',
          sidebarText: '#94a3b8',
        },
        risk: {
          high: '#dc2626',      // Crimson Red
          medium: '#d97706',    // Amber Orange
          low: '#16a34a',       // Emerald Green
          hard: '#7c3aed',      // Purple
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'Geist Sans', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Roboto Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
