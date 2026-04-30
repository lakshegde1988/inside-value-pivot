import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
      colors: {
        bg: {
          primary: "#080c14",
          secondary: "#0e1420",
          card: "#111827",
          hover: "#161f30",
          border: "#1e2d42",
        },
        accent: {
          green: "#00d26a",
          red: "#ff4757",
          blue: "#3d9bff",
          gold: "#f59e0b",
          muted: "#374151",
        },
        text: {
          primary: "#e8edf5",
          secondary: "#8899aa",
          muted: "#4a5568",
        },
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulse_slow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 2s linear infinite",
        pulse_slow: "pulse_slow 2s ease-in-out infinite",
        slideUp: "slideUp 0.3s ease-out",
        fadeIn: "fadeIn 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
