export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Light theme makeover
        background: '#ffffff',        // Page background
        surface: '#f8f9fa',           // Cards, panels
        border: '#d1d5db',            // Dividers/borders
        primary: '#2563eb',           // Button base (TON blue)
        'primary-hover': '#1d4ed8',   // Button hover
        text: '#000000',              // Main text
        subtext: '#6b7280',           // Dimmed/inactive text
        accent: '#1e3a8a',            // Highlights (dark blue frames)
        brand: {
          gold: '#f1c40f',            // Optional brand gold
          black: '#000000'            // Contrast color
        }
      }
    }
  },
  plugins: []
};
