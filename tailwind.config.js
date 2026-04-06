/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,jsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        gold: { 50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f',950:'#451a03' },
        dark: { 50:'#f8f8f8',100:'#e8e8e8',200:'#c8c8c8',300:'#a0a0a0',400:'#707070',500:'#484848',600:'#303030',700:'#242424',800:'#1a1a1a',850:'#151515',900:'#111111',950:'#0a0a0a' },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Rajdhani', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in':      'fadeIn 0.3s ease-out',
        'slide-up':     'slideUp 0.4s ease-out',
        'pulse-gold':   'pulseGold 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':    'spin 3s linear infinite',
        'bounce-subtle':'bounceSubtle 1s infinite',
      },
      keyframes: {
        fadeIn:       { '0%':{ opacity:'0' },                            '100%':{ opacity:'1' } },
        slideUp:      { '0%':{ opacity:'0', transform:'translateY(20px)' }, '100%':{ opacity:'1', transform:'translateY(0)' } },
        pulseGold:    { '0%,100%':{ opacity:'1' },                      '50%':{ opacity:'0.6' } },
        bounceSubtle: { '0%,100%':{ transform:'translateY(-3px)' },     '50%':{ transform:'translateY(0)' } },
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #f59e0b, #d97706)',
        'dark-gradient': 'linear-gradient(180deg, #1a1a1a, #0a0a0a)',
      },
      boxShadow: {
        'gold':    '0 0 20px rgba(245,158,11,0.3)',
        'gold-lg': '0 0 40px rgba(245,158,11,0.4)',
        'dark':    '0 4px 20px rgba(0,0,0,0.5)',
        'card':    '0 2px 8px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
