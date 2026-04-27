import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#151515",
        mango: "#ffb11f",
        hoja: "#117a4a",
        cielo: "#e6f3ff"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(21, 21, 21, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
