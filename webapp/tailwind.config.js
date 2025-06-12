export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // TonPlaygram premium theme
        background: '#0b0f19',        // Page background
        surface: '#11172a',           // Cards, panels
        border: '#27272a',            // Dividers/borders
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
