# Product Requirements Document (PRD): AI Trivia (Cruise Mode)

**Version:** 2.1
**Status:** Draft
**Last updated:** June 19, 2026

---

## 1. Overview

**Name:** AI Trivia (Cruise Mode)

**Concept:** A voice-first, AI-hosted trivia game for two players. A conversational AI host presents questions, evaluates spoken or typed answers for *semantic* correctness, offers hints, tracks score, and banters with the players. The experience is designed to run hands-free — ideal for long car rides — while still supporting touch/typed input as a fallback.

**What's new in v2.1:**
- **Directed-question + steal** core loop (each question is assigned to one player; the opponent can steal a miss; assignment alternates).
- A **turn-balance fix** so being on the clock is an opportunity, not a tax (the stealer answers second, with more information — the scoring now accounts for that).
- A dedicated **Voice Reliability** section (the echo loop and shared-mic attribution are the real engineering risks).
- A **Question Integrity** section (the host generating *and* grading its own questions is the biggest trust risk for an LLM trivia game).
- A defined **Host Persona** (most of the fun lives here).
- **Model-agnostic LLM requirements** described by characteristics rather than a specific vendor/model.

---

## 2. Goals & Non-Goals

### Goals
- Deliver a fun, low-friction, fully hands-free two-player trivia experience.
- Make turn ownership and steal opportunities unambiguous through both **audio** and **visual** cues.
- Keep the host fast and conversational so the game feels like a live game show, not a form.
- Make scoring transparent and easy to correct when the AI misjudges a spoken answer.
- Treat **answer-key correctness** and **voice reliability** as first-class requirements, not features.

### Non-Goals (out of scope for this format's v1)
- More than two players or team play.
- Persistent accounts, cross-session history, or online leaderboards.
- Multiplayer across separate devices (single shared device only).
- Adaptive difficulty / question leveling (possible later enhancement).

---

## 3. Target Audience

Two people sharing one device who want an engaging, hands-free game show — primarily during long drives, but also anywhere a conversational format beats reading a screen. Players are assumed to be co-located and able to hear shared audio.

**Default players:** Player One (Jesse) and Player Two (Linzee). Names are configurable.

---

## 4. Core Gameplay & Flow

### 4.1 The Core Loop (Directed Question + Steal)

Each question is **directed to one player** ("on the clock"). The opponent answers only if the first player misses, and the assignment alternates every question.

1. **Assign.** The host directs the question to the active player and names them aloud (e.g., *"Jesse, this one's for you…"*). The turn indicator highlights that player.
2. **Primary attempt.** The active player answers (voice or text). They may request a **hint** or **pass**.
   - **Correct →** award primary points. Go to step 5.
   - **Incorrect / pass / timeout →** open a **steal**. Go to step 3.
3. **Steal offered.** The host turns to the opponent (*"Linzee, want to steal it?"*). The turn indicator switches and the UI shows a **STEAL** state.
4. **Steal attempt.** The opponent answers, or passes.
   - **Correct →** award steal points.
   - **Incorrect / pass →** no points; host reveals the answer.
5. **Resolve & advance.** Host reveals the answer (if not already), updates the scoreboard, banters, and **alternates** the assignment for the next question.

> **Alternation rule:** The on-the-clock player alternates strictly by question number, independent of who scored. The steal is a bonus opportunity, not a turn change.

### 4.2 Turn Balance — Why Primary > Steal

The stealer holds a structural advantage: they answer **second**, after hearing the primary player think aloud and eliminate at least one wrong answer, and they take **no risk** by passing. Left unaddressed, the safe off-turn seat becomes the better seat. Three levers correct this; the default uses asymmetric scoring, with the others available as settings:

- **Asymmetric scoring (default):** answering your own question is worth more than stealing (see §4.4).
- **Lock-in (optional):** the primary player may "lock in" a confident answer for a small bonus; a wrong lock-in forfeits the steal-block bonus. Adds risk/reward to the primary seat.
- **Category pick (optional):** the player who answered their *own* last question correctly chooses the next category, giving the primary seat a recurring perk a stealer never earns.

### 4.3 Keeping Both Players Engaged

During the primary phase the off-turn player has nothing to do. To keep both heads in the game, the off-turn player may submit a **silent guess** (typed, or tapped on their side) before the steal is offered. It never affects scoring on the primary attempt; at reveal, the host can call out a correct silent guess for bragging rights. This preserves "will they get it?" tension without letting the off-turn player shout over the primary.

### 4.4 Scoring (default; values configurable)

| Outcome | Points |
|---|---|
| Primary answers correctly | **+2** to primary |
| Steal succeeds | **+1** to stealer |
| Steal fails / both pass | 0 to both; answer revealed |
| Correct lock-in (if enabled) | **+3** to primary; wrong lock-in = 0 and no steal-block credit |

**Configurable variants:**
- **Steal value:** 1 (default) vs. 2 (symmetric, if you prefer information-advantage to win out).
- **Hint penalty:** none (default) vs. correct-after-hint worth one less point.
- **Hints on steals:** stealer gets no hint (default) vs. one hint allowed.

### 4.5 State Machine

```
SETUP
  └─> ASK (question directed to primary)
        └─> AWAIT_PRIMARY   (off-turn player may log a silent guess)
              ├─ correct ──────────────> RESOLVE (award primary)
              ├─ hint ─> AWAIT_PRIMARY (loop)
              ├─ lock-in ─> RESOLVE (award/deny per result)
              └─ wrong / pass / timeout ─> STEAL_OFFER
                                              └─> AWAIT_STEAL
                                                    ├─ correct ─> RESOLVE (award stealer)
                                                    └─ wrong / pass ─> RESOLVE (no award, reveal)
RESOLVE
  └─> ADVANCE (alternate primary, increment question #) ──> ASK
```

---

## 5. Features & Capabilities

### 5.1 Player Interaction
- **Speech-to-Text (mic):** Web Speech API recognition so players can speak answers, hints, passes, and commands hands-free.
- **Per-player push-to-talk (recommended):** A talk button per player (or a single shared one for the on-the-clock player) that gates the mic. This is the primary mechanism for attributing input to the right player on a shared device — see §9.
- **Text input:** Standard field for typing answers, chatting, or issuing commands.
- **Text-to-Speech (audio):** The host speaks questions, banter, turn assignments, steal offers, and results aloud via browser speech synthesis.

### 5.2 Turn & Steal UX
- **Turn indicator:** Always-visible cue showing who is on the clock; updates instantly on assignment and on steal.
- **Steal banner:** A distinct visual + audio state when a steal is live.
- **Spoken assignment:** The host always names the target player when presenting a question and when offering a steal.

### 5.3 Off-Turn Engagement
- **Silent guess:** Off-turn player may privately log a guess before the steal opens (see §4.3); surfaced at reveal for fun, never for points on the primary attempt.

### 5.4 Score Management & Moderation
- **Two-player scoreboard:** Side-by-side point displays; active player highlighted.
- **Manual point overrides:** Quick buttons to correct bad rulings or misheard input: **Award Player One**, **Award Player Two**, **Tie/Both**, **Nobody**. Apply to the currently resolving question.
- **Turn override:** Control to manually set or swap who is on the clock after a voice mishap.

### 5.5 Game Controls (quick-access, no prompting required)
- **New Game:** Restart session and wipe scoreboard.
- **Hint:** Clue for the player on the clock, no forfeit.
- **Pass:** On-the-clock player gives up — triggers steal (if primary) or reveal (if stealer).
- **Reveal:** Force the host to reveal the answer if both give up.
- **Next Question:** Skip, resolve with no award, and advance (alternating as normal).

---

## 6. Question Integrity & Answer Validation

For an LLM trivia game, the host both **writing** and **grading** questions is the single biggest trust risk: if the model is confidently wrong about its own answer key, it will mark a correct player wrong and players may not know to challenge it. Requirements:

- **Separate generation from grading state.** The correct answer is fixed at question-creation time and passed to the grader as ground truth; the grader does not re-derive it under social pressure from a player's answer.
- **Data-grounded primary source.** The primary source is `TmdbMovieSource`, which builds movie questions from TMDB structured data using templates such as director, release year, cast-by-character, and Best Picture by year. The answer comes from the source data, not from a model.
- **Provider selection and fallback.** The server selects a source through `createQuestionProvider` and `QUESTION_SOURCE` behind the `QuestionProvider` interface. Supported sources are `static`, `generated`, and `tmdb`. The static vetted bank remains the fallback when the TMDB key is missing or TMDB is unreachable.
- **Difficulty is data-derived.** `TriviaQuestion` includes `difficulty: "easy" | "medium" | "hard"`. Difficulty is derived from data filters, not a model rating: easy favors high-popularity movies plus lead role/director questions; hard favors low-popularity titles, supporting cast, character names, exact years, or grosses.
- **Recalibration hook.** `recordQuestionResult` logs per-question success rate for later empirical difficulty tuning. Difficulty is not yet wired into gameplay, and recorded results are not yet read back; both are future work.
- **Generous, deferential ruling.** The grader accepts synonyms, partial credit, and phonetic/spoken approximations, and when a player **challenges** a ruling, the host defers quickly rather than digging in. The override buttons are the final backstop.
- **Avoid ambiguous/contested questions.** Prefer questions with a single unambiguous answer; avoid "most/best/-est" framings prone to dispute.
- **Generated source is optional.** Generated questions must still match the selected category and difficulty, with no answer leaking into the prompt, and must be verified before serving.

---

## 7. Voice Reliability & Input Handling

Voice is the product, so its failure modes are requirements, not edge cases.

- **Echo-loop prevention (critical).** An always-listening mic will transcribe the host's own TTS as a player answer. The mic **must be muted (or recognition paused) whenever the host is speaking**, resuming only after synthesis ends — or input must be gated behind push-to-talk so the mic is open only on demand.
- **Speaker attribution on a shared device.** A single mic cannot tell Jesse from Linzee. The system does **not** assume it can. Attribution is handled by **per-player push-to-talk** (preferred) or treated as a **social contract** enforced by the turn indicator and override buttons. The PRD explicitly does not claim the mic knows who is talking.
- **Out-of-turn input.** During the primary phase, input not from the on-the-clock player is ignored for scoring (the host may acknowledge it with light banter). It becomes valid for the stealer in the steal phase.
- **Recognition errors.** On low-confidence transcripts the host re-prompts the same player once before treating it as a pass; overrides are always available.
- **Graceful degradation.** If the Speech API is unavailable, the game is fully playable via text and on-screen controls; the host still speaks if synthesis is available.
- **Listening affordance.** A clear visual indicator shows when the mic is actively listening.

---

## 8. AI Host: Behavior, Persona & Prompt Requirements

### 8.1 Behavior & Structured Output
The host logic must be **turn-aware**. Each turn it receives at minimum: the question, the ground-truth answer, who is on the clock, the phase (primary vs. steal), and the score. It must:
- Open each question by naming the target player.
- Judge answers **semantically**, not by string match.
- On a wrong primary answer, **explicitly offer the steal to the opponent by name** and never reveal before the steal resolves.
- Keep banter short to preserve pacing; longer recaps are reserved for end-of-round.
- Return a **machine-readable result** the engine acts on, e.g.:
  `{ ruling: "correct" | "incorrect" | "needs_clarification", awardTo: "primary" | "steal" | "none", spokenText: "…" }`
  so scoring and transitions are data-driven, not parsed from prose.

### 8.2 Host Persona & Voice
The host's personality is most of why this format is fun over a two-hour drive. Define it explicitly:

- **Voice:** a quick, warm, slightly cheeky game-show host. Confident, never mean. Celebrates good answers, teases gently on misses, keeps energy up.
- **Pacing:** short lines. Banter is a sentence, not a paragraph. The game keeps moving.
- **Running bits:** light, score-aware callbacks (a recurring joke about a lopsided lead, a nickname that sticks) — fun, never belittling.
- **Family-friendly:** appropriate for a shared car with anyone present.

**Illustrative lines (tone reference, not scripts):**
- *Presenting:* "Alright Jesse — eyes on the road, mind on the prize. For two points…"
- *Correct:* "Boom. Didn't even hesitate. Two for Jesse."
- *Wrong → steal:* "Ooh, not quite. Linzee — door's wide open, want to steal it?"
- *Steal success:* "Stolen, clean. That's gotta sting, Jesse."
- *Both miss:* "Tough one — nobody's getting that. The answer was [X]. Onward."
- *Score gap:* "Linzee pulling away here. Jesse, this next one's yours — time to make it interesting."

---

## 9. LLM Model Characteristics (vendor- and model-agnostic)

The app does not depend on a specific provider or model. Select any model that meets the following, behind a **pluggable server-side abstraction** so the model can be swapped without client changes. Characteristics are ordered roughly by importance for this use case.

1. **Low, consistent latency (top priority).** Real-time conversational pacing requires fast responses; **time-to-first-token** matters most because output is streamed into TTS. A faster, slightly less capable model generally beats a smarter, slower one here.
2. **Streaming support.** The host should begin speaking before the full reply is generated, cutting perceived latency.
3. **Reliable structured output.** Must return valid, schema-conformant JSON on essentially every turn; malformed output breaks state transitions. Native JSON/structured-output or tool-calling modes are strongly preferred.
4. **Strong instruction-following & steerability.** Holds a defined persona and rule set consistently across a long session without drift.
5. **Sound semantic judgment.** Good common-sense reasoning to grade free-form spoken answers — synonyms, partial answers, phonetic approximations — generously but not naively.
6. **Factual reliability / low hallucination.** For generating questions and self-checking answer keys; or at minimum, reliably follows a "verify before asserting / defer when challenged" instruction.
7. **Tool / function-calling reliability.** If question sourcing or verification uses external lookups.
8. **Cost efficiency at volume.** Many short calls per session; low per-call cost enables more banter, hints, and turns within budget.
9. **Adequate context window.** Enough to hold game state, recent history, persona, and rules — modest, not large; the priority is not dropping state, not raw size.
10. **Content safety.** Family-friendly output suitable for a shared setting.
11. **Availability & a fallback path.** Stable API uptime, with the abstraction allowing a backup provider/model.
12. **(Optional) Multilingual.** If non-English categories or players are desired.

**Tiering option:** a **fast, cheap model** can handle in-game ruling and banter (latency-critical), while a **stronger model** generates and verifies questions ahead of time (quality-critical, latency-tolerant, often done pre-game or asynchronously). The abstraction in §10 should allow different models for these two roles.

---

## 10. Technical Architecture

- **Frontend:** React (Vite) + Tailwind CSS.
- **Backend:** Node.js / Express (`server.ts`) acting as a secure API proxy **and the authoritative game engine** — it owns game state (whose turn, phase, score, question #) so client and host stay in sync. Voice input is error-prone, so the server is the single source of truth: the client renders state and emits events (`answer`, `hint`, `pass`, `lockIn`, `override`); the server validates, calls the model, and returns new state.
- **LLM access:** A **provider-agnostic model abstraction** on the server (see §9). Models are configured, not hard-coded, and may differ for the *ruling/banter* role vs. the *question-generation/verification* role.
- **Browser APIs:** Web Speech API (Recognition + Synthesis), with mic gating tied to TTS state (§7).

---

## 11. Data Model (Game State)

```
GameState {
  players: [{ id, name, score }]          // exactly 2
  questionNumber: int
  onTheClockPlayerId: id                   // current primary
  phase: "primary" | "steal" | "resolved"
  currentQuestion: { prompt, answer, category, verified: bool }
  silentGuess: { playerId, text } | null
  hintsUsedThisQuestion: int
  settings: {
    primaryValue, stealValue, lockInEnabled, hintPenalty,
    categoryPickEnabled, firstPlayer, timerSeconds (optional), categories
  }
}
```

---

## 12. UI/UX Design

**Theme:** Dark mode with vibrant, high-contrast neon accents (rose red, gold, indigo) for a premium, retro-arcade game-show feel.

**Layout:**
- **Header:** App title, mode indicator, settings.
- **Scoreboard:** Two large metric cards side-by-side; the on-the-clock player is clearly highlighted, and a steal shifts the highlight to the opponent.
- **Host banter box:** Distinct elevated container showing current dialogue, active question number, and current phase (e.g., a "STEAL" badge).
- **Input & controls:** Fixed at the bottom — push-to-talk button(s), mic state, text input, and quick-action toolbars (Hint / Pass / Lock-in / Reveal / Next / overrides). Single cohesive game board, zero complex navigation.

**Accessibility & car-use considerations:**
- Large tap targets and high contrast for glanceable use by a passenger.
- All critical state changes (turn, steal, result) are conveyed by audio, so the screen is optional.
- Clear, distinct visual indicator when the mic is actively listening.

---

## 13. Edge Cases & Error Handling

- **Misheard answer:** host returns `needs_clarification`, re-prompts the same player once, then treats silence as a pass. Overrides always available.
- **Both players miss:** no points; reveal; advance with normal alternation.
- **Player answers out of turn:** ignored for scoring in the primary phase (light banter ok); valid for the stealer in the steal phase.
- **Host TTS picked up as input:** prevented by mic gating (§7).
- **Disputed ruling:** host defers to a challenge; override buttons are the backstop.
- **Optional timeout:** soft per-attempt timer (configurable, off by default for a relaxed drive); on expiry the host nudges, then treats it as a pass.
- **Speech API unavailable:** fully playable via text + on-screen controls.
- **Model/network failure:** clear retry path; score and turn state preserved server-side.

---

## 14. Latency & Performance Budget

Latency is a hard requirement for a voice game, not just a metric.

- **Host begins speaking** within **~1.5 s** of the player finishing their answer (via streaming; time-to-first-token is the key lever).
- **Full ruling + state update** within **~2.5 s**.
- **Question presentation** within **~1.5 s** of advancing (pre-fetch the next question during the prior reveal where possible).
- If a call exceeds budget, the host plays a short spoken filler ("Let me think…") rather than going silent.

---

## 15. Success Metrics

- **Engagement:** average questions per session; full-drive sessions.
- **Hands-free reliability:** % of answers handled by voice without a manual override.
- **Ruling accuracy:** manual override rate (lower is better) as a proxy for host + answer-key quality.
- **Answer-key trust:** rate of challenged rulings; rate later confirmed as host error.
- **Pacing:** median time from question presented to resolved; % of turns within the §14 budget.
- **Fun signal:** repeat-session rate / "New Game" taps per session.

---

## 16. Phasing / MVP

**MVP (v1):**
- Directed-question + steal loop with **asymmetric scoring** (primary +2 / steal +1).
- Push-to-talk for input attribution + mic gating during TTS.
- Vetted question bank (or generate-then-verify) with separate generation/grading.
- Defined host persona, semantic grading, structured output.
- Scoreboard, turn indicator, steal state, manual overrides, core controls.
- Provider-agnostic model abstraction (single model is fine for MVP).

**Phase 2:**
- Lock-in mechanic, category pick, silent guesses.
- Tiered models (fast ruling model + stronger verification model).
- Optional timers, end-of-round recaps, running-bit memory.

**Later:**
- Adaptive difficulty, more categories, additional polish on persona/voice.

---

## 17. Assumptions & Open Questions

**Assumptions**
- Single shared device with working speaker and microphone; both players co-located.
- Browser supports Web Speech API (Recognition + Synthesis).

**Open questions**
1. **Steal value:** keep asymmetric (primary +2 / steal +1, default) or go symmetric?
2. **Lock-in:** ship in MVP or hold for Phase 2?
3. **Input model:** push-to-talk (most reliable) vs. open-mic with TTS gating — or offer both?
4. **Question source:** curated bank, live generation-with-verification, or a hybrid?
5. **Round structure:** fixed N questions per round, or open-ended until "New Game"?
6. **Timeout:** include the optional per-attempt timer in v1?
7. **Tie-breaking:** sudden-death finish or final score only?
