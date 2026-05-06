import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1D1D1B",
        mango: "#D8C893",
        hoja: "#6F7F5B",
        sage: "#A8B59A",
        cielo: "#EDF1E7",
        crema: "#F6F3EC",
        card: "#FBF9F4"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(29, 29, 27, 0.075)",
        lift: "0 26px 70px rgba(29, 29, 27, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
