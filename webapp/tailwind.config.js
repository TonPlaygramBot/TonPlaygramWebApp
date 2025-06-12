export default {

  content: [

    './index.html',

    './src/**/*.{js,jsx}',

  ],

  theme: {

    extend: {

      colors: {

        background: '#0c0e1a',        // Darker base

        surface: '#15182b',           // Card or panel background

        border: '#20243a',            // Border lines

        primary: '#3b82f6',           // Action buttons (blue)

        'primary-hover': '#2563eb',   // Hover state

        text: '#f1f5f9',              // Main text color

        subtext: '#94a3b8',           // Dimmed/inactive text

        accent: '#facc15',            // Yellow accents (buttons, highlights)

        brand: {

          gold: '#f1c40f',            // Optional branding gold

          black: '#000000'

        }

      }

    }

  },

  plugins: []

};