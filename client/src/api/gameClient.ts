import {
  GameEngine,
  getQuestions,
  LocalDemoGrader,
  type Difficulty,
  type GameEvent,
  type GameState,
  type Grader
} from "../../../shared/src/index.ts";
import { RemoteGrader } from "../grading/remoteGrader.ts";

// Client-authoritative for this single-shared-device game: the browser runs the
// same tested engine the server tests cover and owns GameState in this module.
// The exact-match grader runs locally; the LLM grader (Dash) is opt-in and only
// then makes a network call (to the stateless /api/grade function).
const useLlmGrader =
  (import.meta as unknown as { env?: { VITE_SHOTGUN_GRADER?: string } }).env?.VITE_SHOTGUN_GRADER === "llm";

const grader: Grader = useLlmGrader ? new RemoteGrader() : new LocalDemoGrader();
const engine = new GameEngine({ grader, questions: getQuestions() });

let state: GameState = engine.startGame();

export async function fetchGameState(): Promise<GameState> {
  return state;
}

export async function startNewGame(difficulty: Difficulty = "medium"): Promise<GameState> {
  state = engine.startGame({ difficulty, questions: getQuestions({ difficulty }) });
  return state;
}

export async function sendGameEvent(event: GameEvent): Promise<GameState> {
  if (event.type === "startGame") {
    return startNewGame(event.difficulty ?? "medium");
  }

  state = await engine.handleEventAsync(state, event);
  return state;
}
