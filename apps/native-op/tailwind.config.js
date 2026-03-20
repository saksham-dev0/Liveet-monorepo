/** @type {import('tailwindcss').Config} */
module.exports = {
  // Update this to include all files that use Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#0F8BFF",
          light: "#E6F2FF",
          navy: "#0A1929",
          muted: "#64748B",
          border: "#E2E8F0",
          "input-bg": "#F8FAFC",
          surface: "#F1F5F9",
          "page-bg": "#F8FAFD",
        },
      },
    },
  },
  plugins: [],
};

