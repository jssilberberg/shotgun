# Shotgun — Brand Assets (for the build)

These are **decided values**. Don't redesign them; consume them.

## Where things go in the repo
```
/public/brand/icon.svg          # app tile (the buzzer); pure geometry, font-free
/public/brand/lockup.svg        # horizontal logo: buzzer + SHOTGUN (red O)
/public/brand/lockup-mono.svg   # single-color logo (uses currentColor)
/src/styles/tokens.css          # CSS variables (import at app root)
tailwind.config.js              # merge in tailwind.tokens.js under theme.extend
```

## Hard rules (put these in AGENTS.md too)
- **Use these tokens; never hard-code hex values.** Color comes from `tokens.css` / Tailwind theme only.
- **Buzzer red (`#F5294E`) is rationed** — buzz-in, the steal banner, and wrong-answer states ONLY. Never ordinary buttons. If red is everywhere, the steal stops feeling dangerous.
- **Active turn + primary buttons = indigo.** Scores, winner, logo = gold. Background = night.
- **Fonts:** load `Anton` (display) and `Inter` (body) in the app; the SVG wordmarks rely on `Anton` being present. Use `font-display` only for the logo and scoreboard numerals; everything else is `font-body`.
- **Don't regenerate the logo.** Use the SVGs in `/public/brand` as-is.

## Logos render with live fonts
`lockup.svg` / `lockup-mono.svg` use `<text>` in Anton (consistent with the app, which loads Anton). For any **static export** where the font isn't guaranteed (emails, OG images, favicons), outline the text to paths first, e.g.:
```
# pick one
inkscape lockup.svg --export-type=svg --export-text-to-path -o lockup-outlined.svg
# or via fonttools/picosvg, or "Object > Path > Object to Path" in a vector editor
```
`icon.svg` has no text and needs no outlining.

## Host & voice = content, not styling
- The host persona + signature lines (BRAND.md §2) go into the **LLM system prompt** when you build the host (PRD Phase 2). The host's name is **Dash**.
- UI copy follows the host's tone, quieter: plain verbs, sentence case, buttons say what they do ("Steal it", not "Submit").

## Audio = wire hooks now, drop real files later
The sound stings (BRAND.md §3) don't exist yet. Build named, swappable hooks against placeholder files so the code is ready:
```
onBuzz, onSteal, onCorrect, onWrong, onWin, onTurnChange, idleBed
```
Each maps to `/public/audio/<name>.mp3` (placeholders for now). Keep them behind a single `playCue(name)` so real audio swaps in without touching feature code. Respect a global mute.
