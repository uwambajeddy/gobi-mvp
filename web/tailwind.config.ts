import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/**
 * Trimmed version of the Gobi platform Tailwind theme that
 * keeps the brand palette while dropping marketing-site animations.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      sm: "575px",
      md: "768px",
      lg: "1025px",
      xl: "1202px",
    },
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      fontFamily: {
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        accent: "#f36a46",
        "accent-dark": "#ff8f71",
        "accent-light": "#ff9a7c",
        "light-base": "#f5f8fa",
        primary: {
          50: "#fff7f5",
          100: "#ffece6",
          200: "#ffd5c7",
          300: "#ffb49e",
          400: "#ff8a65",
          500: "#fd5523",
          600: "#eb3d0e",
          700: "#c52e0a",
          800: "#9e280e",
          900: "#822510",
          DEFAULT: "#fd5523",
        },
        secondary: "#FFAC00",
        dark: "#020e28",
        shade: "#ECF0F1",
        mute: "#788094",
        "body-text": "#535353",
        green: { ...colors.emerald, DEFAULT: "#10b981" },
        red: { ...colors.red, DEFAULT: "#EF4444" },
        yellow: { ...colors.amber, DEFAULT: "#FBBF24" },
        blue: { ...colors.blue, DEFAULT: "#428AF8" },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
