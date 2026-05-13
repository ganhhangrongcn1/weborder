export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "Arial"]
      },
      colors: {
        orange: {
          500: "#FF5A1F",
          600: "#FF6A00"
        },
        cream: "#FFF7EC",
        brown: "#3A1F14"
      },
      boxShadow: {
        soft: "0 12px 34px rgba(58, 31, 20, 0.08)",
        orange: "0 12px 24px rgba(255, 90, 31, 0.24)",
        top: "0 -12px 32px rgba(58, 31, 20, 0.08)"
      }
    }
  },
  plugins: []
};
