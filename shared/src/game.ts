export type PlayerId = "p1" | "p2";

export type GamePhase = "primary" | "steal" | "resolved" | "complete";

export type GradeRuling = "correct" | "incorrect" | "needs_clarification";

export type ManualAward = "p1" | "p2" | "tie" | "nobody";

export type Difficulty = "easy" | "medium" | "hard";

export interface Player {
  id: PlayerId;
  name: string;
  score: number;
}

export interface TriviaQuestion {
  id: string;
  prompt: string;
  answer: string;
  category: string;
  difficulty: Difficulty;
  verified: boolean;
}

export interface GameSettings {
  primaryValue: number;
  stealValue: number;
  lockInEnabled: boolean;
  hintPenalty: "none" | "minusOne";
  categoryPickEnabled: boolean;
  firstPlayer: PlayerId;
  difficulty: Difficulty;
  timerSeconds?: number;
  questionsPerGame?: number;
  categories: string[];
}

export interface SilentGuess {
  playerId: PlayerId;
  text: string;
}

export type ResolutionReason =
  | "primary_correct"
  | "steal_correct"
  | "both_missed"
  | "manual_override"
  | "skipped";

export interface QuestionResolution {
  questionNumber: number;
  reason: ResolutionReason;
  answerRevealed: boolean;
  award: ManualAward | null;
  awardedPoints: Partial<Record<PlayerId, number>>;
}

export interface LastAction {
  type: string;
  ignored?: boolean;
  ruling?: GradeRuling;
  message?: string;
  spokenText?: string;
}

export interface GameState {
  players: [Player, Player];
  questionNumber: number;
  onTheClockPlayerId: PlayerId;
  phase: GamePhase;
  currentQuestion: TriviaQuestion;
  silentGuess: SilentGuess | null;
  hintsUsedThisQuestion: number;
  settings: GameSettings;
  resolution: QuestionResolution | null;
  lastAction: LastAction | null;
}
