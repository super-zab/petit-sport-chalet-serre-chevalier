import type { Config } from "tailwindcss";

// Couleur lue dans une variable CSS "R G B" (voir app/globals.css), avec gestion de l'opacité.
const fromVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: fromVar("--background"),
        foreground: fromVar("--foreground"),
        border: fromVar("--border"),
        input: fromVar("--input"),
        ring: fromVar("--ring"),
        muted: { DEFAULT: fromVar("--muted"), foreground: fromVar("--muted-foreground") },
        destructive: { DEFAULT: fromVar("--destructive"), foreground: fromVar("--destructive-foreground") },
        "chalet-cream": "#F9F7F2",
        "chalet-cream-light": "#F5F2EB",
        "chalet-brown": "#4A3C32",
        "chalet-brown-dark": "#3E342F",
        "chalet-muted": "#8B7D6B",
        "chalet-greige": "#D9D2C5",
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
