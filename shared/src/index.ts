export type {
  GamePhase,
  GameSettings,
  GameState,
  GradeRuling,
  Difficulty,
  LastAction,
  ManualAward,
  Player,
  PlayerId,
  QuestionResolution,
  ResolutionReason,
  SilentGuess,
  TriviaQuestion
} from "./game.ts";

export type {
  GameEvent,
  ManualOverrideEvent,
  NextQuestionEvent,
  PassEvent,
  RevealEvent,
  RequestHintEvent,
  StartGameEvent,
  SubmitAnswerEvent
} from "./events.ts";

export type {
  GameEventRequest,
  GameEventResponse,
  GameStateResponse
} from "./api.ts";

// Deterministic game engine — the single source of truth, run by the client and
// exercised by the server tests.
export {
  GameEngine,
  buildQuestionOrder,
  shuffleQuestions,
  primaryForQuestion,
  opponentOf,
  winnerOf
} from "./engine/gameEngine.ts";
export type { GameEngineOptions, StartGameOptions, Rng } from "./engine/gameEngine.ts";

export type { Grader, GradeContext, GradeResult } from "./grading/Grader.ts";
export { LocalDemoGrader } from "./grading/localDemoGrader.ts";
export { MockGrader } from "./grading/mockGrader.ts";

export { GENERATED_QUESTIONS } from "./questions/generatedBank.ts";
export type { GeneratedQuestion } from "./questions/generatedBank.ts";
export { getQuestions } from "./questions/questionBank.ts";
export type { QuestionQuery } from "./questions/questionBank.ts";
