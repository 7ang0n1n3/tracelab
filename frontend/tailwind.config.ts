import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "rgb(var(--color-bg) / <alpha-value>)",
          surface:  "rgb(var(--color-bg-surface) / <alpha-value>)",
          elevated: "rgb(var(--color-bg-elevated) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          bright:  "rgb(var(--color-accent-bright) / <alpha-value>)",
          dim:     "rgb(var(--color-accent-dim) / <alpha-value>)",
        },
        success: "#22c55e",
        danger:  "#ef4444",
        warning: "#f59e0b",
        muted:   "rgb(var(--color-muted) / <alpha-value>)",
        border:  "rgb(var(--color-border) / <alpha-value>)",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
