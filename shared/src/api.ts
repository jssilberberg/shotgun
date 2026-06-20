import type { GameEvent } from "./events.ts";
import type { GameState } from "./game.ts";

export interface GameStateResponse {
  state: GameState;
}

export interface GameEventRequest {
  event: GameEvent;
}

export interface GameEventResponse {
  state: GameState;
}
