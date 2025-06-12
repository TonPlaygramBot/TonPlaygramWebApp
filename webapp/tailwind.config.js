export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0c0e1a',        // Page background
        surface: '#15182b',           // Cards, containers
        border: '#20243a',            // Lines/dividers
        primary: '#3b82f6',           // Button base
        'primary-hover': '#2563eb',   // Hover state
        text: '#f1f5f9',              // Main text
        subtext: '#94a3b8',           // Dimmed or hint text
        accent: '#facc15',            // Highlight (yellow)
        brand: {
          gold: '#f1c40f',            // Optional gold accent
          black: '#000000',           // For contrast/logo
        }
      }
    }
  },
  plugins: []
};
