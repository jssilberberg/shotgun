import type { Difficulty, ManualAward, PlayerId } from "./game.ts";

export interface StartGameEvent {
  type: "startGame";
  playerNames?: [string, string];
  difficulty?: Difficulty;
}

export interface SubmitAnswerEvent {
  type: "submitAnswer";
  playerId: PlayerId;
  answer: string;
}

export interface RequestHintEvent {
  type: "requestHint";
  playerId: PlayerId;
}

export interface PassEvent {
  type: "pass";
  playerId: PlayerId;
}

export interface ManualOverrideEvent {
  type: "manualOverride";
  award: ManualAward;
}

export interface NextQuestionEvent {
  type: "nextQuestion";
}

export interface RevealEvent {
  type: "reveal";
}

export type GameEvent =
  | StartGameEvent
  | SubmitAnswerEvent
  | RequestHintEvent
  | PassEvent
  | ManualOverrideEvent
  | NextQuestionEvent
  | RevealEvent;
