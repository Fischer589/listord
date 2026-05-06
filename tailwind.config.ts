import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1F1F1C",
        mango: "#D8C893",
        hoja: "#6F7F5B",
        sage: "#A8B59A",
        cielo: "#EDF1E7",
        crema: "#F5F2EA",
        card: "#FAF8F3"
      },
      boxShadow: {
        soft: "0 16px 42px rgba(31, 31, 28, 0.07)",
        lift: "0 22px 60px rgba(31, 31, 28, 0.09)"
      }
    }
  },
  plugins: []
};

export default config;
