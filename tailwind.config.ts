import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(0 0% 4%)",
        panel: "hsl(0 0% 7%)",
        border: "hsl(0 0% 14%)",
        text: "hsl(0 0% 92%)",
        muted: "hsl(0 0% 70%)",
        /* Robinhood-ish: green + teal + soft cyan */
        accent: "hsl(156 72% 45%)",
        accent2: "hsl(190 90% 55%)",
        accent3: "hsl(142 71% 45%)",
        good: "hsl(142 71% 45%)",
        bad: "hsl(0 84% 60%)"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.45)",
        glow: "0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.6)"
      }
    }
  },
  plugins: []
} satisfies Config;


