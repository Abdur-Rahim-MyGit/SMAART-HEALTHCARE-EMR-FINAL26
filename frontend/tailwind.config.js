/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#ECF2FF",
          100: "#D9E6FF",
          200: "#B3CEFF",
          300: "#8DB7FF",
          400: "#3F82FF",
          500: "#2563EB", // brand blue
          600: "#1E4FD0",
          700: "#1A43AC",
          800: "#163987",
          900: "#122E6C",
        },
        mint: {
          50: "#E8FFF8",
          100: "#CFFBEF",
          200: "#A0F5DF",
          300: "#72EFD0",
          400: "#44E9C1",
          500: "#19D9AC",
          600: "#13B991",
          700: "#0E9C7A",
          800: "#0A7D63",
          900: "#075D4A",
        },
        slate: {
          25: "#FCFDFE",
        },
      },
      borderRadius: {
        xl: "0.9rem",
        '2xl': "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.10)",
        card: "0 8px 20px rgba(16,24,40,0.06)",
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(37,99,235,0.3)' },
          '70%': { boxShadow: '0 0 0 12px rgba(37,99,235,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(37,99,235,0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn .25s ease-out',
        pulseRing: 'pulseRing 2s cubic-bezier(0.165, 0.84, 0.44, 1) infinite',
      },
    },
  },
  plugins: [],
};
