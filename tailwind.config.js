/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // AAA Dark Fantasy Palette
        obsidian: {
          950: '#060508',
          900: '#0c0a10',
          850: '#110e17',
          800: '#18141f',
          700: '#221d2e',
          600: '#2e2840',
        },
        gold: {
          50: '#fef9e7',
          100: '#fdf0c4',
          200: '#fbe28a',
          300: '#f5d06e',
          400: '#e8b93e',
          500: '#c9a84c',
          600: '#a88930',
          700: '#8b6f20',
          800: '#6b5518',
          900: '#4a3a0f',
        },
        crimson: {
          50: '#fde8ec',
          100: '#f9c5cf',
          200: '#f2919f',
          300: '#e85a6d',
          400: '#c41e3a',
          500: '#a21830',
          600: '#8b1a1a',
          700: '#6f1515',
          800: '#4e0d0d',
          900: '#2d0808',
        },
        parchment: {
          50: '#faf6ed',
          100: '#f0e8d4',
          200: '#e3d5b2',
          300: '#d4c090',
          400: '#bfa66b',
          500: '#a38d52',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        crimsonText: ['"Crimson Text"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'gold-glow': '0 0 15px rgba(201, 168, 76, 0.4), 0 0 40px rgba(201, 168, 76, 0.15)',
        'gold-glow-lg': '0 0 25px rgba(201, 168, 76, 0.5), 0 0 60px rgba(201, 168, 76, 0.2)',
        'crimson-glow': '0 0 15px rgba(196, 30, 58, 0.5), 0 0 40px rgba(139, 26, 26, 0.3)',
        'crimson-glow-lg': '0 0 25px rgba(196, 30, 58, 0.6), 0 0 60px rgba(139, 26, 26, 0.3)',
        'ember': '0 0 8px rgba(245, 208, 110, 0.3)',
        'blue-crest': '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.2)',
        'red-crest': '0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.2)',
        'inner-glow': 'inset 0 0 20px rgba(201, 168, 76, 0.15)',
        'dark-vignette': 'inset 0 0 80px rgba(0, 0, 0, 0.6)',
      },
      backgroundImage: {
        'fantasy-gradient': 'linear-gradient(180deg, #110e17 0%, #0c0a10 50%, #060508 100%)',
        'gold-shimmer': 'linear-gradient(135deg, #c9a84c 0%, #f5d06e 40%, #c9a84c 60%, #a88930 100%)',
        'parchment-grain': 'linear-gradient(135deg, rgba(240, 232, 212, 0.05) 0%, transparent 50%, rgba(240, 232, 212, 0.03) 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite',
        'ember-float': 'emberFloat 3s ease-in-out infinite',
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'battle-shake': 'battleShake 0.5s ease-in-out',
        'sword-reveal': 'swordReveal 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'title-reveal': 'titleReveal 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'crest-pulse': 'crestPulse 2s ease-in-out infinite',
        'hp-drain': 'hpDrain 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateX(-50%) translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(201, 168, 76, 0.3), 0 0 40px rgba(201, 168, 76, 0.1)' },
          '50%': { boxShadow: '0 0 25px rgba(201, 168, 76, 0.6), 0 0 60px rgba(201, 168, 76, 0.25)' },
        },
        emberFloat: {
          '0%, 100%': { transform: 'translateY(0) scale(1)', opacity: '0.7' },
          '50%': { transform: 'translateY(-8px) scale(1.1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        battleShake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%': { transform: 'translateX(-3px) rotate(-0.5deg)' },
          '20%': { transform: 'translateX(3px) rotate(0.5deg)' },
          '30%': { transform: 'translateX(-2px) rotate(-0.3deg)' },
          '40%': { transform: 'translateX(2px) rotate(0.3deg)' },
          '50%': { transform: 'translateX(-1px)' },
        },
        swordReveal: {
          '0%': { opacity: '0', transform: 'scale(0.5) rotate(-180deg)' },
          '60%': { opacity: '1', transform: 'scale(1.15) rotate(10deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        titleReveal: {
          '0%': { opacity: '0', letterSpacing: '0.5em', filter: 'blur(8px)' },
          '50%': { opacity: '0.7', letterSpacing: '0.3em', filter: 'blur(2px)' },
          '100%': { opacity: '1', letterSpacing: '0.15em', filter: 'blur(0)' },
        },
        crestPulse: {
          '0%, 100%': { filter: 'brightness(1) drop-shadow(0 0 4px rgba(201, 168, 76, 0.3))' },
          '50%': { filter: 'brightness(1.2) drop-shadow(0 0 12px rgba(201, 168, 76, 0.6))' },
        },
        hpDrain: {
          '0%': { filter: 'brightness(2)' },
          '100%': { filter: 'brightness(1)' },
        },
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [],
}
