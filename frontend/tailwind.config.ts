import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0d0d14",
          surface: "#13131f",
          elevated: "#1a1a2e",
        },
        accent: {
          DEFAULT: "#7c3aed",
          bright: "#a855f7",
          dim: "#4c1d95",
        },
        success: "#22c55e",
        danger: "#ef4444",
        warning: "#f59e0b",
        muted: "#6b7280",
        border: "#1f1f35",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
