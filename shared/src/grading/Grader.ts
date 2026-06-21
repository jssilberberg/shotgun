import type { GameState, GradeRuling, PlayerId, TriviaQuestion } from "../game.ts";

export interface GradeContext {
  playerId: PlayerId;
  state: GameState;
  question: TriviaQuestion;
}

export interface GradeResult {
  ruling: GradeRuling;
  spokenText?: string;
}

export interface Grader {
  grade(answer: string, groundTruth: string, context: GradeContext): GradeResult | Promise<GradeResult>;
}
