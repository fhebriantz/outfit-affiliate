/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Shopee orange
        brand: {
          50: '#fef6f5',
          100: '#fdeae6',
          200: '#fbcdc2',
          300: '#f7a795',
          400: '#f37a5f',
          500: '#ee4d2d',
          600: '#e23b1d',
          700: '#bd3017',
          800: '#992815',
          900: '#7e2415',
        },
        // Secondary blue
        sec: {
          50: '#eef3fb',
          100: '#d8e3f6',
          200: '#b0c6ec',
          300: '#7ba2df',
          400: '#3f73c9',
          500: '#1453b3',
          600: '#0046ab',
          700: '#003a8c',
          800: '#00306f',
          900: '#002654',
        },
      },
      backgroundImage: {
        shopee: 'linear-gradient(#ee4d2d, #ff7337)',
      },
    },
  },
  plugins: [],
}
