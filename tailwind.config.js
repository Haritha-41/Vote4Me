/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          600: "#0284c7",
          700: "#0369a1",
        },
        googleBlue: "#4285F4",
        googleRed: "#EA4335",
        googleYellow: "#FBBC05",
        googleGreen: "#34A853",
      },
      boxShadow: {
        soft: "0 6px 24px rgba(17, 24, 39, 0.08)",
      },
    },
  },
  plugins: [],
};
