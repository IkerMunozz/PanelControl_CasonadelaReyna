/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        casona: {
          blue: "#378ADD",
          amber: "#BA7517",
          teal: "#1D9E75",
          purple: "#534AB7",
          red: "#E24B4A"
        }
      }
    }
  },
  plugins: []
};
