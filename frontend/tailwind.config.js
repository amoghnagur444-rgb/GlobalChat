/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        globally: {
          purple: '#8B5CF6',
          darkPurple: '#6D28D9',
          lilac: '#DDD6FE',
          darkText: '#1E1B4B',
          peerBubble: '#F3F4F6',
        }
      }
    },
  },
  plugins: [],
}