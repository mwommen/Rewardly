/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        panel: "#182033",
        card: "#222b42",
        line: "#34415f",
        cyan: "#38bdf8",
        gold: "#fbbf24"
      }
    }
  },
  plugins: []
};
