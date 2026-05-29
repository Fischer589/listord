import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink:   "#1A3D2B",   /* V2: dark forest green */
        hoja:  "#2D7A4F",   /* V2: mid brand green */
        sage:  "#A8B59A",   /* keep — used for skill chips */
        cielo: "#E6F2EC",   /* V2: light green wash */
        crema: "#EDE7D9",   /* V2: warm linen */
        card:  "#F5F0E5",   /* V2: soft ivory surface */
        mango: "#D8C893",   /* keep for compatibility */
        green: {
          light: "#45A85A",
          DEFAULT: "#2D7A4F",
          dark: "#163424",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 3px rgba(26,61,43,0.06)",
        lift: "0 8px 40px rgba(26,61,43,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
