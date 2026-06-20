# Shotgun — Brand Sheet

**Voice-first trivia for two. Built for the road.**

---

## 1. Name

**Shotgun** — *Trivia for the road.*

You call shotgun for the front seat: it's inherently two-player, inherently road-trip, one punchy word, and it carries the quick-draw / buzz-in energy a game show wants. "Cruise Mode" survives as an optional subtitle.

**Signature mark:** the **O** in SH**O**TGUN *is* the buzzer — rendered in Buzzer Red against the gold logotype. The whole identity hangs off that one detail (it also ties to the push-to-talk button players actually press).

---

## 2. The host *is* the brand

This is a voice game. Players stare at a phone on the dash for two hours but they *listen* to the host the whole time. The host's voice, timing, and catchphrases are the primary brand asset — design them before any logo.

**Host name: Dash.** (Dashboard + dashing + the pace of play.)

**Persona:** part late-night radio DJ, part game-show host. Velvet voice, fast mouth, generous with praise. Ribs the player in the lead, never the one who's losing. Keeps the car moving — short lines, never a monologue. Family-friendly by default.

**Signature lines** (tone reference, write many variants so it never repeats):
- *Your turn:* "You're up." / "Talk to me."
- *Correct:* "Nailed it — two for you."
- *Wrong → steal:* "Ooh, open season. Wanna steal it?"
- *Steal success:* "Stolen, clean. That's gotta sting."
- *Both miss:* "Nobody? It was [X]. Roll on."
- *Win:* "Chequered flag — [name] takes it."
- *Running bit:* a recurring, affectionate jab at a lopsided lead.

---

## 3. Audio identity (commission these)

The sound set is as important as the logo. Keep it short, punchy, and consistent — same key, same "instrument," so the game has one sonic signature.

| Cue | Feel | When |
|---|---|---|
| **Buzz-in sting** | sharp, bright | a player takes the question / push-to-talk |
| **Steal sting** | rising, sly | the steal opportunity opens |
| **Correct chime** | warm, gold | right answer |
| **Wrong buzzer** | short, red, not harsh | wrong answer |
| **Win fanfare** | triumphant, brief | end of game |
| **Turn whoosh** | soft pass | question hands to the other player |
| **Idle bed** | low engine-hum ambience | menus / between questions (optional, mutable) |

---

## 4. Color roles

The palette already lives in the PRD; the point is the **roles** — what each color is allowed to do.

| Color | Hex | Role |
|---|---|---|
| **Night Indigo** | `#14123A` | The canvas. Night-drive base background. |
| **Ink** | `#0C0B24` | Deepest background / vignette. |
| **Prize Gold** | `#F6C544` | The hero. Logotype, scores, the winner, anything you want to feel like a prize. |
| **Buzzer Red** | `#F5294E` | Reserved for tension only: buzz-in, the steal banner, wrong answers, the buzzer dome. Don't dilute it on ordinary UI. |
| **Electric Indigo** | `#4B47D6` | Interactive elements, the active-turn highlight, primary buttons. |
| **Headlight** | `#CDE8FF` | Highlights, glows, beams, secondary text on dark. |

**Discipline:** Gold = good things happening. Red = something is *at stake*. If red is everywhere, the steal stops feeling dangerous.

---

## 5. Typography roles

| Role | Face | Use |
|---|---|---|
| **Display** | Anton (or similar heavy condensed) | Logotype, scores, big host moments — marquee energy. |
| **Body / UI** | Inter | Questions, controls, settings, everything readable. |
| **Data** | Inter / Anton | Scores in display for drama; small numerals in Inter. |

Set scores large and condensed — they're a scoreboard, not body text. Keep everything else quiet so the display face and the buzzer-O stay the memorable beats.

---

## 6. Logo & icon direction

- **Lockup:** buzzer icon + "SHOTGUN" wordmark with the red O. Horizontal lockup for headers; icon alone for the app tile.
- **App icon:** the glowing buzzer (gold ring, red dome, white hotspot) on a Night-Indigo rounded square. Reads at a glance on a phone propped on the dash — that's the real test.
- **Clear space:** keep at least the height of the buzzer around the lockup; nothing crowds the mark.
- **Don'ts:** don't recolor the O anything but Buzzer Red; don't put the wordmark on a busy background; don't stretch the condensed type; don't add a second accent color to the logo.
- **Production note:** ship the wordmark as **outlined paths**, not live font, so it renders identically everywhere.

---

## 7. UI voice & tone

Same personality as Dash, just quieter and functional. Plain verbs, sentence case, buttons say exactly what happens.

- Buttons: "Steal it", "Pass", "Hint", "New game" — not "Submit".
- The action keeps its name through the flow: a **Steal** button leads to a **"Stolen!"** result.
- Empty/failure states stay in character and tell you what to do: *"Couldn't hear that — tap to talk and try again,"* not an apology.
