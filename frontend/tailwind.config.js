/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#111111",
        "surface-hover": "#1a1a1a",
        primary: "var(--color-primary, #FF4500)",
        "primary-rgb": "var(--color-primary-rgb, 255, 69, 0)",
        outline: "rgba(255, 255, 255, 0.1)",
        "text-main": "#f5f5f5",
        "text-dim": "rgba(245, 245, 245, 0.6)",
      },
      fontFamily: {
        headline: ["Syne", "sans-serif"],
        body: ["Manrope", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
}
