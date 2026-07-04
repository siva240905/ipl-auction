/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          dark: '#06090e',       // Deep slate-black background
          card: '#0c111a',       // Dark card background
          border: '#17212d',     // Sleek slate border
          grass: '#00e653',      // Punchy neon green
          accent: '#00e653',     // Neon green accents
          glow: '#00e653',       // Glowing neon green
          gold: '#ffb703',
          crimson: '#ff3b30'      // Vibrant red for timers/alerts
        }
      },
      fontFamily: {
        sports: ['Outfit', 'sans-serif'],
        accent: ['Orbitron', 'sans-serif']
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s infinite alternate',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards'
      },
      keyframes: {
        pulseGlow: {
          '0%': { boxShadow: '0 0 5px rgba(57, 255, 20, 0.2), inset 0 0 5px rgba(57, 255, 20, 0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(57, 255, 20, 0.6), inset 0 0 10px rgba(57, 255, 20, 0.3)' }
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      }
    },
  },
  plugins: [],
}
