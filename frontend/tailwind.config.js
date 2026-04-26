/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#f97316',
          l: '#fb923c',
          d: '#ea580c',
        }
      }
    },
  },
  plugins: [],
}
