/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#16324F',
        orange: '#E8821E',
        bg: '#F4F6FA',
        teal: '#1F8A73',
        blue: '#2F5FA8',
        indigo: '#5661B3',
        orchid: '#B15EA0',
        danger: '#C23B32',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Poppins', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
