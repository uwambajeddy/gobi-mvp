import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/**
 * Gobi design tokens.
 *
 * Neutrals and semantic colours are CSS variables (see app/globals.css) so a
 * future theme only has to redefine the variables. Every text/background pair
 * below was checked for WCAG AA contrast; brand-500 is reserved for icons,
 * marks and active indicators (3.0:1), while actions use primary-600 (4.7:1).
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

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
      "2xl": "1440px",
    },
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      fontFamily: {
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Sentence-case group label: set apart by weight and colour, not caps.
        overline: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.005em", fontWeight: "600" }],
        caption: ["0.75rem", { lineHeight: "1.125rem" }],
        label: ["0.8125rem", { lineHeight: "1.25rem", fontWeight: "500" }],
        body: ["0.875rem", { lineHeight: "1.375rem" }],
        heading: ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        title: ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.015em", fontWeight: "600" }],
        display: ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em", fontWeight: "600" }],
      },
      colors: {
        canvas: token("canvas"),
        surface: {
          DEFAULT: token("surface"),
          muted: token("surface-muted"),
          sunken: token("surface-sunken"),
        },
        line: {
          DEFAULT: token("line"),
          strong: token("line-strong"),
        },
        ink: {
          DEFAULT: token("ink"),
          secondary: token("ink-secondary"),
          muted: token("ink-muted"),
          subtle: token("ink-subtle"),
        },
        // Built around the logo orange (500); the other steps keep the previous
        // lightness ladder, moved to the logo's hue and chroma in OKLCH.
        primary: {
          50: "#FEF4F0",
          100: "#FCE7DE",
          200: "#F9CDBB",
          300: "#F5AC90",
          400: "#F28662",
          500: "#F36A46",
          600: "#C74A2E",
          700: "#A93E26",
          800: "#86321F",
          900: "#6D2B1C",
          DEFAULT: "#F36A46",
        },
        success: {
          DEFAULT: token("success"),
          fg: token("success-fg"),
          soft: token("success-soft"),
          line: token("success-line"),
        },
        warning: {
          DEFAULT: token("warning"),
          fg: token("warning-fg"),
          soft: token("warning-soft"),
          line: token("warning-line"),
        },
        danger: {
          DEFAULT: token("danger"),
          fg: token("danger-fg"),
          soft: token("danger-soft"),
          line: token("danger-line"),
        },
        info: {
          DEFAULT: token("info"),
          fg: token("info-fg"),
          soft: token("info-soft"),
          line: token("info-line"),
        },
        // Legacy aliases, kept so older class names resolve to the new palette.
        dark: token("ink"),
        mute: token("ink-muted"),
        "body-text": token("ink-secondary"),
        "light-base": token("canvas"),
        green: { ...colors.emerald, DEFAULT: "#10b981" },
        red: { ...colors.red, DEFAULT: "#EF4444" },
        yellow: { ...colors.amber, DEFAULT: "#FBBF24" },
        blue: { ...colors.blue, DEFAULT: "#428AF8" },
      },
      borderRadius: {
        control: "0.625rem",
        inset: "0.75rem",
        card: "1.125rem",
        panel: "1.375rem",
      },
      boxShadow: {
        // Ink-tinted so panels sit on the mist canvas instead of floating grey.
        card: "0 1px 2px rgb(15 26 51 / 0.06), 0 3px 8px -2px rgb(15 26 51 / 0.05)",
        raised: "0 12px 28px -10px rgb(15 26 51 / 0.18), 0 2px 6px -2px rgb(15 26 51 / 0.07)",
        overlay: "0 24px 56px -12px rgb(16 24 40 / 0.25), 0 4px 12px -4px rgb(16 24 40 / 0.08)",
        brand: "0 6px 14px -6px rgb(199 74 46 / 0.55)",
      },
      spacing: {
        "control-sm": "2.125rem",
        control: "2.5rem",
        "control-lg": "2.875rem",
        topbar: "4rem",
        sidebar: "17rem",
        "sidebar-collapsed": "5rem",
      },
      maxWidth: {
        content: "88rem",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": {
          from: { opacity: "0", transform: "translateY(6px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        // Landing route: a stop is checked as the truck passes (see MilestoneRoute).
        "stop-ping": { "0%": { transform: "scale(1)", opacity: "0.6" }, "100%": { transform: "scale(3.5)", opacity: "0" } },
        "tile-pop": {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "45%": { transform: "translateY(-4px) scale(1.12)" },
        },
        "badge-in": {
          "0%": { transform: "scale(0) rotate(-90deg)", opacity: "0" },
          "60%": { transform: "scale(1.25) rotate(10deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "tile-burst": { "0%": { transform: "scale(1)", opacity: "0.8" }, "100%": { transform: "scale(1.75)", opacity: "0" } },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "pop-in": "pop-in 160ms ease-out",
        "slide-in-left": "slide-in-left 200ms ease-out",
        "fade-up": "fade-up 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
        marquee: "marquee 48s linear infinite",
        // Ping on the road, then (once the post has filled) the sign pops and the badge lands.
        "stop-ping": "stop-ping 900ms cubic-bezier(0, 0, 0.2, 1) forwards",
        "tile-pop": "tile-pop 500ms ease-out 250ms both",
        "badge-in": "badge-in 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 320ms both",
        "tile-burst": "tile-burst 800ms cubic-bezier(0, 0, 0.2, 1) 250ms both",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
