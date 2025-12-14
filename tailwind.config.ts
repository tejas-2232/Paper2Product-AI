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
        accent: "hsl(221 83% 60%)",
        good: "hsl(142 71% 45%)",
        bad: "hsl(0 84% 60%)"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.45)"
      }
    }
  },
  plugins: []
} satisfies Config;


