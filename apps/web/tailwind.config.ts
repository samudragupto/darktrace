import type { Config } from "tailwindcss";

// Colours resolve through CSS variables (see globals.css) so a `.ink` panel can
// re-map the same semantic tokens to its dark palette.
const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        border: token("border"),
        text: token("text"),
        muted: token("muted"),
        ink: token("ink"), // primary fill: near-black on light, near-white inside .ink
        "on-ink": token("on-ink"),
        accent: token("accent"), // amber - extraction detected
        danger: token("danger"), // crimson - loss
        good: token("good"), // green - rebate paid
        arkiv: token("arkiv"), // violet - Arkiv record / archived
        info: token("info"), // blue - simulated
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        DEFAULT: "10px",
        md: "10px",
        card: "22px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.25), 0 8px 24px -12px rgb(0 0 0 / 0.5)",
        float: "0 2px 4px rgb(0 0 0 / 0.3), 0 16px 40px -16px rgb(0 0 0 / 0.7)",
      },
    },
  },
  plugins: [],
};

export default config;
