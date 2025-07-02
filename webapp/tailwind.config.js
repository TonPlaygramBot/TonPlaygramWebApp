export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // TonPlaygram premium theme
        background: '#1a082c',        // Page background (dark purple)
        surface: '#14213d',           // Cards, panels (dark blue)
        border: '#334155',            // Dividers/borders (dark blue)
        primary: '#2563eb',           // Button base (TON blue)
        'primary-hover': '#1d4ed8',   // Button hover
        text: '#ffffff',              // Main text
        subtext: '#94a3b8',           // Dimmed/inactive text
        accent: '#facc15',            // Highlights (yellow/gold)
        brand: {
          gold: '#f1c40f',            // Optional brand gold
          black: '#000000'            // Contrast color
        }
      }
    }
  },
  plugins: []
};
