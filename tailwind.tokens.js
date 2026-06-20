/* Shotgun — paste into tailwind.config.js under theme.extend.
   Then use semantic classes: bg-night, text-gold, ring-indigo, bg-buzzer, etc. */

module.exports = {
  theme: {
    extend: {
      colors: {
        ink:       '#0C0B24', // deepest background
        night:     '#14123A', // app background
        indigo:    '#4B47D6', // interactive / active turn
        gold:      '#F6C544', // hero: logo, scores, wins
        buzzer:    '#F5294E', // RESERVED: buzz-in, steal, wrong
        headlight: '#CDE8FF', // highlights / glow / secondary text
      },
      fontFamily: {
        display: ['Anton', 'Arial Narrow', 'Arial Black', 'Impact', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        tile: '28px',
        card: '16px',
      },
    },
  },
};
