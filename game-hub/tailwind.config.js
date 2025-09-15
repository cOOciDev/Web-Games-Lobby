/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0e0f12",
        panel: "#0b0c10",
        glass: "rgba(255,255,255,0.06)",
        line: "rgba(255,255,255,0.08)",
      },
      boxShadow: {
        glass: "0 8px 30px rgba(0,0,0,0.25)",
        soft: "0 10px 24px rgba(0,0,0,0.22)",
      },
      borderRadius: {
        xl2: "1rem",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
}
