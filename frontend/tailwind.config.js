/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      colors: {
        ink: '#111318',
        panel: '#1B1F27',
        panel2: '#22262F',
        line: '#2C313C',
        mute: '#8A93A3',
        accent: '#10B981',
        accentSoft: '#6EE7B7',
      },
    },
  },
  plugins: [],
}
