import type {
  Difficulty,
  GameEvent,
  GameEventResponse,
  GameState,
  GameStateResponse
} from "../../../shared/src/index.ts";

export async function fetchGameState(): Promise<GameState> {
  const response = await fetch("/api/game/state");
  return unwrapStateResponse<GameStateResponse>(response);
}

export async function startNewGame(difficulty: Difficulty = "medium"): Promise<GameState> {
  const response = await fetch("/api/game/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: { type: "startGame", difficulty } })
  });
  return unwrapStateResponse<GameEventResponse>(response);
}

export async function sendGameEvent(event: GameEvent): Promise<GameState> {
  const response = await fetch("/api/game/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event })
  });
  return unwrapStateResponse<GameEventResponse>(response);
}

async function unwrapStateResponse<T extends { state: GameState }>(response: Response): Promise<GameState> {
  if (!response.ok) {
    throw new Error(`Game API failed with ${response.status}`);
  }

  return (await response.json() as T).state;
}
