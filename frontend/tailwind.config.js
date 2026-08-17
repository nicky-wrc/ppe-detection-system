export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0066cc',
          focus: '#0071e3',
          dark: '#2997ff',
        },
        ink: '#1d1d1f',
        parchment: '#f5f5f7',
        pearl: '#fafafc',
        tile: '#272729',
        hairline: '#e0e0e0',
      },
      borderRadius: {
        apple: '18px',
      },
      fontFamily: {
        sans: ['SF Pro Text', 'SF Pro Display', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
