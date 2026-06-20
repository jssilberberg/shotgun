# AGENTS.md

## Project Contract

Shotgun is a voice-first, two-player AI trivia game. Build it in the phases described in `PRD.md` Section 16: engine first, API second, UI third, LLM integration after the deterministic loop works, and voice last.

Do not write feature code that violates this file. If a future task conflicts with this contract, stop and ask for clarification.

## Stack

- Language: TypeScript throughout, for client, server, and shared contract code.
- Client: React + Vite + Tailwind CSS.
- Server: Node.js + Express, with `server.ts` as the entrypoint.
- Game engine: authoritative server-side state machine.
- LLM: provider-agnostic server-side abstraction. The configured provider/model may change without client changes.
- Speech: browser speech APIs behind client-side interfaces so tests can mock them.

## Folder Layout

```text
shotgun/
  AGENTS.md
  package.json
  tsconfig.base.json

  client/
    package.json
    index.html
    vite.config.ts
    tailwind.config.ts
    postcss.config.js
    public/
      brand/
        icon.svg
        lockup.svg
        lockup-mono.svg
      audio/
        onBuzz.mp3
        onSteal.mp3
        onCorrect.mp3
        onWrong.mp3
        onWin.mp3
        onTurnChange.mp3
        idleBed.mp3
    src/
      main.tsx
      App.tsx
      api/
        gameClient.ts
      components/
      hooks/
      speech/
        SpeechRecognizer.ts
        SpeechSynthesizer.ts
        browserSpeech.ts
        mockSpeech.ts
      styles/
        tokens.css
      audio/
        playCue.ts

  server/
    package.json
    tsconfig.json
    src/
      server.ts
      config/
        env.ts
      engine/
        gameEngine.ts
        stateMachine.ts
        scoring.ts
      grading/
        Grader.ts
        mockGrader.ts
        llmGrader.ts
      llm/
        LlmProvider.ts
        LlmTypes.ts
        providers/
          mockProvider.ts
      questions/
        QuestionProvider.ts
        staticQuestionBank.ts
      routes/
        gameRoutes.ts
      store/
        GameStore.ts
        memoryGameStore.ts

  shared/
    package.json
    tsconfig.json
    src/
      game.ts
      events.ts
      api.ts
      index.ts
```

The `shared/` package is the single source of truth for the client/server contract. Keep it minimal: `GameState`, player/question/settings types, game event types, and API request/response types only. Do not put engine logic, UI types, provider-specific types, or browser-only/server-only details in `shared/`.

## Commands

Use npm workspaces from the repo root.

- Install: `npm install`
- Dev, client and server together: `npm run dev`
- Dev, client only: `npm run dev -w client`
- Dev, server only: `npm run dev -w server`
- Test everything: `npm test`
- Test client: `npm test -w client`
- Test server: `npm test -w server`
- Build everything: `npm run build`
- Build client: `npm run build -w client`
- Build server: `npm run build -w server`
- Build shared types: `npm run build -w shared`
- Lint everything: `npm run lint`
- Lint client: `npm run lint -w client`
- Lint server: `npm run lint -w server`
- Lint shared: `npm run lint -w shared`

## Hard Constraints

- The server owns all game state: whose turn, phase, score, question number, current question, hints, settings, and transition history needed for the current game.
- The client never computes game logic. It only renders server state and emits typed events.
- Client/server communication uses the shared contract types from `shared/`.
- The LLM is always accessed through an interface. Never call a provider SDK directly from feature code.
- Models are configured, not hard-coded. The abstraction must allow different models for ruling/banter and question generation/verification.
- Browser speech APIs are always accessed through interfaces. Never call Web Speech recognition or synthesis directly from feature components.
- API keys are server-side only and must never be shipped to the client.
- The correct answer is fixed before grading. The grader receives ground truth; it does not invent or re-derive the answer during grading.

## Questions

- All question sources implement `QuestionProvider`. The server selects one through `createQuestionProvider` and `QUESTION_SOURCE`; never instantiate a provider directly in `server.ts`.
- Data-grounded answers must come from structured source data and must never be re-derived by a model. The grader checks against the provided ground-truth answer.
- Difficulty stays a data-derived `TriviaQuestion` attribute, not a model judgment.
- The server loads the repo-root `.env` from `server/src/config/env.ts`; keep `TMDB_API_KEY`, `QUESTION_SOURCE`, and `SHOTGUN_GRADER` server-side only and git-ignored.
- `SHOTGUN_GRADER` selects the answer grader: `local` (default) uses `LocalDemoGrader`, an exact-match demo grader that emits no host banter; `llm` uses `LlmHostGrader` for semantic grading and Dash's spoken lines, and requires `OPENAI_API_KEY`. The active grader is logged at startup.
- The static vetted bank is the guaranteed fallback. Missing keys or provider preload failures fall back; they do not crash the server.

## API Shape

MVP communication should be REST:

- `GET /api/game/state`
- `POST /api/game/new`
- `POST /api/game/event`

The client sends typed events such as `answer`, `hint`, `pass`, `lockIn`, `override`, `nextQuestion`, and `reveal`. The server validates the event, advances the authoritative state machine, optionally calls the grader/LLM, and returns the full updated `GameState`.

## Test Expectations

- Phase 1 engine tests use a mock grader. Do not call a live LLM in deterministic engine tests.
- Client tests mock browser speech APIs through the speech interfaces.
- Server tests should cover the directed-question plus steal state machine before UI work expands.
- Shared contract tests or type checks should prevent client/server drift.

## Brand Rules

Use the existing brand assets and tokens. Do not redesign them.

- Use brand tokens from `src/styles/tokens.css` and the Tailwind theme. Never hard-code hex color values in application code.
- Buzzer red is reserved for buzz-in, steal banner, and wrong-answer states only. Do not use it for ordinary buttons or general emphasis.
- Active turn and primary buttons use indigo.
- Scores, winner states, and logo treatment use gold.
- Background uses night.
- Load `Anton` for display/logo/scoreboard numerals and `Inter` for body text.
- Use `font-display` only for the logo and scoreboard numerals. Everything else uses `font-body`.
- Do not regenerate the logo. Use `/public/brand/icon.svg`, `/public/brand/lockup.svg`, and `/public/brand/lockup-mono.svg` as-is.
- The host persona belongs in the LLM system prompt when the host is built. The host's name is Dash.
- UI copy should be quieter than the host: plain verbs, sentence case, and direct button labels.
- Audio cues should go through a single `playCue(name)` interface with a global mute. Planned cue names: `onBuzz`, `onSteal`, `onCorrect`, `onWrong`, `onWin`, `onTurnChange`, `idleBed`.

## Build Order

Follow PRD Section 16:

1. Build and test the server engine first with mock questions and a mock grader.
2. Add the Express API around the engine.
3. Add the React UI as a renderer of server state and emitter of typed events.
4. Add the provider-agnostic LLM implementation behind the existing interfaces.
5. Add browser speech recognition/synthesis last, behind mockable interfaces with TTS/mic gating.
