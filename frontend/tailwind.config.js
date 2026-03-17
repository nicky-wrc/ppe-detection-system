const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4361ee',
          light: '#7b8ff5',
          dark: '#3a53c4',
        },
        secondary: colors.slate,
        background: '#f8f9fa',
      },
    },
  },
  plugins: [],
}