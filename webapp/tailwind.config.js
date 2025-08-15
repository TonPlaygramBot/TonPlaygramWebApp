export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
      extend: {
        colors: {
          // Futuristic neon theme
          background: '#050f1a',        // Dark navy background
          surface: '#050f1a',           // Panels use same dark tone
          border: '#00f7ff',            // Glowing cyan borders
          primary: '#00f7ff',           // Button base in electric blue
          'primary-hover': '#66fcff',   // Lighter hover effect
          text: '#00f7ff',              // Electric blue text
          subtext: '#66fcff',           // Slightly dimmed blue
          accent: '#00f7ff',            // Accent color
          brand: {
            gold: '#facc15',            // Yellow highlight
            black: '#000000'
          }
        },
        fontFamily: {
          sans: ['"Luckiest Guy"', '"Comic Sans MS"', 'cursive']
        }
      }
    },
    plugins: []
  };
