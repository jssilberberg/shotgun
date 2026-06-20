# Codex Build Prompts — AI Trivia (Cruise Mode)

How to use this file:
- Put `PRD.md` (the v2.1 PRD) and this file in the repo root.
- Run the prompts **in order, one session each**. Don't skip ahead — each phase assumes the previous one passed.
- Paste each prompt as-is. After each, review the diff before accepting.
- Golden rules to repeat if Codex drifts: **the server owns all game state; the client only renders state and emits events; the LLM and browser speech APIs are always behind interfaces; API keys live server-side only.**

---

## Prompt 0 — Setup (no app code yet)

```
Read PRD.md in this repo. Do NOT write application code yet.

1. Propose a concrete stack and folder structure consistent with PRD §10:
   - Client: React + Vite + Tailwind.
   - Server: Node + Express, acting as the AUTHORITATIVE game engine.
   - A provider-agnostic LLM abstraction (model configured, not hard-coded).
   List your key decisions (language: TypeScript; how client/server communicate; how state is held) and WAIT for my approval before continuing.

2. After I approve, create AGENTS.md capturing:
   - The stack and folder layout.
   - Exact dev / test / build / lint commands.
   - Hard constraints (non-negotiable):
     * The SERVER owns all game state (whose turn, phase, score, question #). The client never computes game logic — it only renders server state and emits events.
     * The LLM is ALWAYS accessed through an interface; never call a provider SDK directly from feature code.
     * The browser speech APIs (STT/TTS) are ALWAYS accessed through an interface so they can be mocked.
     * API keys are server-side only; never shipped to the client.
   - A note: build in the phases described in PRD §16, engine first, voice last.

Keep changes minimal and stop after creating AGENTS.md.
```

---

## Prompt 1 — Game engine (no LLM, no UI, fully tested)

```
Implement the core game engine as pure server-side logic. No model calls, no React, no browser APIs in this phase.

Source of truth:
- State machine: PRD §4.5.
- GameState shape: PRD §11.
- Scoring (default, asymmetric): PRD §4.4 — primary correct = +2, steal correct = +1, both miss = 0.
- Alternation rule: PRD §4.1 — on-the-clock player alternates strictly by question number, independent of who scored.

Requirements:
- Define a Grader INTERFACE (e.g., grade(answer, groundTruth) -> "correct" | "incorrect" | "needs_clarification"). Provide a MOCK implementation for tests that returns a result on command. Do not implement a real LLM grader yet.
- Implement events: startGame, submitAnswer, requestHint, pass, manualOverride, nextQuestion. Each returns the new GameState.
- Enforce phase rules: in "primary" phase, input from the off-turn player is ignored for scoring; in "steal" phase, the opponent's answer is valid.
- Manual overrides (Award P1 / Award P2 / Tie / Nobody) apply to the currently resolving question.

Write unit tests covering at minimum:
- primary answers correctly (+2, turn alternates next question)
- primary wrong -> steal offered -> steal correct (+1 stealer)
- primary wrong -> steal wrong -> nobody scores, answer revealed
- primary passes -> steal offered
- out-of-turn input during primary phase is ignored
- manual override changes the score correctly
- alternation holds across several questions regardless of who scored

Run the tests and fix all failures before you stop. Report coverage of the state machine.
```

---

## Prompt 2 — LLM host/grader behind the interface

```
Implement the real LLM host/grader behind the Grader interface from Phase 1. Keep all Phase 1 tests passing (the mock grader stays for tests).

Structured-output contract (use EXACTLY this shape — do not invent your own):
  { "ruling": "correct" | "incorrect" | "needs_clarification",
    "awardTo": "primary" | "steal" | "none",
    "spokenText": "..." }

Requirements:
- Build a provider-agnostic LLM client interface; load the model + key from server-side config/env. Provide one concrete implementation, but keep feature code depending only on the interface.
- The host must be turn-aware: it receives the question, the GROUND-TRUTH answer, who is on the clock, the phase, and the score (PRD §8.1).
- Grading is semantic, not string-match, and generous on synonyms/partial/phonetic answers; on a challenge it should defer (PRD §6).
- The ground-truth answer is fixed at question-creation time and passed to the grader; the grader must NOT re-derive the answer from the player's input (PRD §6).
- Validate every model response against the JSON schema above. On malformed output, retry once with a repair instruction; if still invalid, return a safe fallback ("needs_clarification") rather than crashing.
- Host persona/tone: follow PRD §8.2. Keep spokenText short.

Question sourcing (PRD §6):
- Implement a small VETTED question bank (JSON) as the default source: { prompt, answer, category }.
- Add an optional generate-then-verify path behind a flag, but default to the bank for now.

Add tests for: schema validation, the malformed-output repair path, and that ground-truth is passed through (not re-derived). Run all tests and fix failures before stopping.
```

---

## Prompt 3 — React UI rendering server state

```
Build the React + Vite + Tailwind client. The client renders server GameState and emits events only — it must contain NO game logic or scoring.

Implement per PRD §12:
- Scoreboard: two side-by-side cards; the on-the-clock player is clearly highlighted; a steal shifts the highlight to the opponent.
- Host banter box: shows current spokenText, question number, and a phase badge (e.g., "STEAL").
- Controls (buttons that emit events): Hint, Pass, Reveal, Next Question, and manual overrides (Award P1 / Award P2 / Tie / Nobody).
- Text input for typed answers/commands.
- Dark mode, high-contrast neon accents (rose red, gold, indigo); large tap targets for glanceable use.

Do NOT add microphone or text-to-speech yet — leave a clear, isolated seam (the speech interface) where Phase 4 will plug in. Wire all buttons and the text input to the server events from Phase 1/2. Run the build and confirm the full primary->steal->resolve loop works end-to-end with typed input.
```

---

## Prompt 4 — Voice layer (last, behind an interface)

```
Add the voice layer behind the speech interface seam from Phase 3. Browser-only; I will test this manually.

Implement per PRD §7:
- Text-to-Speech: the host speaks spokenText via the Web Speech API synthesis.
- Speech-to-Text: Web Speech API recognition for spoken answers/commands.
- ECHO-LOOP FIX (critical): recognition MUST be paused/muted whenever the host is speaking, and resume only after synthesis ends. Add this as the default behavior.
- Per-player push-to-talk: a talk control that gates the mic; this is how input is attributed to the on-the-clock player. Do NOT assume the mic can identify the speaker.
- Visual "listening" indicator when the mic is active.
- Graceful degradation: if the Speech API is unavailable, the game stays fully playable via text + on-screen controls (Phase 3 behavior).

Keep all prior tests passing; mock the speech APIs in any tests. Confirm the build succeeds and tell me exactly what to test by hand in the browser.
```

---

## Optional follow-on prompts (PRD §16 Phase 2+)

Run these only after the MVP works end-to-end:

```
Add the lock-in mechanic (PRD §4.2 / §4.4): the primary player may lock in a confident answer for +3; a wrong lock-in scores 0 and forfeits the steal-block bonus. Update the engine, tests, and UI control.
```

```
Add the silent-guess feature (PRD §4.3): the off-turn player can privately log a guess before the steal opens; it never affects the primary score; surface a correct silent guess at reveal. Update engine, tests, and a minimal UI affordance.
```

```
Add model tiering (PRD §9): allow a fast/cheap model for in-game ruling+banter and a stronger model for offline question generation/verification, configured independently behind the existing LLM interface. No feature-code changes outside the interface.
```

---

## If Codex goes off the rails

- "You're putting game logic in the client. Move all scoring/state to the server; the client only renders and emits events."
- "Don't call the model SDK directly here — go through the Grader/LLM interface."
- "Re-read PRD §[N] and AGENTS.md, then correct this."
- "Stop adding scope. Implement only what this prompt asks, then run tests."
