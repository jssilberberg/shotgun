export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--rgb-ink) / <alpha-value>)",
        night: "rgb(var(--rgb-night) / <alpha-value>)",
        indigo: "rgb(var(--rgb-indigo) / <alpha-value>)",
        gold: "rgb(var(--rgb-gold) / <alpha-value>)",
        buzzer: "rgb(var(--rgb-buzzer) / <alpha-value>)",
        headlight: "rgb(var(--rgb-headlight) / <alpha-value>)"
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)"
      },
      borderRadius: {
        tile: "var(--radius-tile)",
        card: "var(--radius-card)"
      }
    }
  },
  plugins: []
};
