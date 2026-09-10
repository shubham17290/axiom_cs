/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Phase 5 §5.2 semantic tokens (values defined as CSS variables in globals.css)
        bg: "var(--bg)",
        surface: "var(--surface)",
        primary: {
          DEFAULT: "var(--primary)",
          strong: "var(--primary-strong)",
          soft: "var(--primary-soft)",
        },
        // PREPForge "forge" accent (teal) — PG-STD-01
        accent: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-strong)",
          soft: "var(--accent-soft)",
          ink: "var(--accent-ink)",
        },
        ink: "var(--text)",
        muted: "var(--muted)",
        success: { DEFAULT: "var(--success)", soft: "var(--success-soft)" },
        warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)" },
        danger: { DEFAULT: "var(--danger)", soft: "var(--danger-soft)" },
        info: "var(--info)",
        line: "var(--border)",
      },
      borderRadius: {
        sm2: "var(--radius-sm)",
        md2: "var(--radius-md)",
        lg2: "var(--radius-lg)",
      },
      boxShadow: {
        low: "var(--shadow-low)",
        med: "var(--shadow-med)",
      },
      maxWidth: {
        content: "72rem",
      },
    },
  },
  plugins: [],
};
