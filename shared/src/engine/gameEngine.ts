import type { GameEvent, PassEvent, RequestHintEvent, SubmitAnswerEvent } from "../events.ts";
import type {
  GameSettings,
  GameState,
  GradeRuling,
  ManualAward,
  Player,
  PlayerId,
  ResolutionReason,
  TriviaQuestion
} from "../game.ts";
import type { GradeResult, Grader } from "../grading/Grader.ts";

export type Rng = () => number;

export interface GameEngineOptions {
  grader: Grader;
  questions: TriviaQuestion[];
  settings?: Partial<GameSettings>;
  rng?: Rng;
  recentQuestionLimit?: number;
}

export interface StartGameOptions {
  playerNames?: [string, string];
  difficulty?: GameSettings["difficulty"];
  questions?: TriviaQuestion[];
}

const DEFAULT_SETTINGS: GameSettings = {
  primaryValue: 2,
  stealValue: 1,
  lockInEnabled: false,
  hintPenalty: "none",
  categoryPickEnabled: false,
  firstPlayer: "p1",
  difficulty: "medium",
  questionsPerGame: 10,
  categories: []
};

export class GameEngine {
  private readonly grader: Grader;
  private readonly questions: TriviaQuestion[];
  private readonly baseSettings: GameSettings;
  private readonly rng: Rng;
  private readonly recentQuestionLimit: number;
  private activeQuestions: TriviaQuestion[];
  private recentQuestionIds: string[] = [];

  public constructor(options: GameEngineOptions) {
    if (options.questions.length === 0) {
      throw new Error("GameEngine requires at least one question");
    }

    this.grader = options.grader;
    this.questions = options.questions;
    this.activeQuestions = options.questions;
    this.baseSettings = { ...DEFAULT_SETTINGS, ...options.settings };
    this.rng = options.rng ?? Math.random;
    this.recentQuestionLimit = options.recentQuestionLimit ?? 5;
  }

  public startGame(options: StartGameOptions = {}): GameState {
    const gameQuestions = options.questions ?? this.questions;
    if (gameQuestions.length === 0) {
      throw new Error("GameEngine requires at least one question to start a game");
    }

    this.activeQuestions = buildQuestionOrder(gameQuestions, this.rng, this.recentQuestionIds);
    const players = createPlayers(options.playerNames);
    const questionNumber = 1;
    const settings = {
      ...this.baseSettings,
      difficulty: options.difficulty ?? this.baseSettings.difficulty
    };
    const primaryPlayerId = primaryForQuestion(questionNumber, settings.firstPlayer);
    const currentQuestion = this.questionFor(questionNumber);
    this.rememberServedQuestion(currentQuestion.id);

    return {
      players,
      questionNumber,
      onTheClockPlayerId: primaryPlayerId,
      phase: "primary",
      currentQuestion,
      silentGuess: null,
      hintsUsedThisQuestion: 0,
      settings,
      resolution: null,
      lastAction: {
        type: "startGame",
        spokenText: `${playerName(players, primaryPlayerId)}, this one's for you. ${currentQuestion.prompt}`
      }
    };
  }

  public handleEvent(state: GameState | null, event: GameEvent): GameState {
    if (event.type === "startGame") {
      return this.startGame({
        ...(event.playerNames ? { playerNames: event.playerNames } : {}),
        ...(event.difficulty ? { difficulty: event.difficulty } : {})
      });
    }

    if (!state) {
      throw new Error(`${event.type} requires an active game`);
    }

    switch (event.type) {
      case "submitAnswer":
        return this.submitAnswer(state, event);
      case "requestHint":
        return this.requestHint(state, event);
      case "pass":
        return this.pass(state, event);
      case "manualOverride":
        return this.manualOverride(state, event.award);
      case "nextQuestion":
        return this.nextQuestion(state);
      case "reveal":
        return this.reveal(state);
      default:
        return assertNever(event);
    }
  }

  public async handleEventAsync(state: GameState | null, event: GameEvent): Promise<GameState> {
    if (event.type === "submitAnswer") {
      if (!state) {
        throw new Error(`${event.type} requires an active game`);
      }

      return this.submitAnswerAsync(state, event);
    }

    return this.handleEvent(state, event);
  }

  public submitAnswer(state: GameState, event: SubmitAnswerEvent): GameState {
    if (!isAnswerable(state.phase)) {
      return withLastAction(state, {
        type: "submitAnswer",
        ignored: true,
        message: "Not accepting answers right now"
      });
    }

    if (event.playerId !== state.onTheClockPlayerId) {
      return withLastAction(state, {
        type: "submitAnswer",
        ignored: true,
        message: "Out-of-turn input ignored"
      });
    }

    const result = this.grader.grade(event.answer, state.currentQuestion.answer, {
      playerId: event.playerId,
      state,
      question: state.currentQuestion
    });

    if (isPromiseLike(result)) {
      throw new Error("submitAnswer received an async grader; use submitAnswerAsync instead");
    }

    return state.phase === "primary"
      ? this.applyPrimaryRuling(state, result)
      : this.applyStealRuling(state, result);
  }

  public async submitAnswerAsync(state: GameState, event: SubmitAnswerEvent): Promise<GameState> {
    if (!isAnswerable(state.phase)) {
      return withLastAction(state, {
        type: "submitAnswer",
        ignored: true,
        message: "Not accepting answers right now"
      });
    }

    if (event.playerId !== state.onTheClockPlayerId) {
      return withLastAction(state, {
        type: "submitAnswer",
        ignored: true,
        message: "Out-of-turn input ignored"
      });
    }

    const result = await this.grader.grade(event.answer, state.currentQuestion.answer, {
      playerId: event.playerId,
      state,
      question: state.currentQuestion
    });

    return state.phase === "primary"
      ? this.applyPrimaryRuling(state, result)
      : this.applyStealRuling(state, result);
  }

  public requestHint(state: GameState, event: RequestHintEvent): GameState {
    if (!isAnswerable(state.phase) || event.playerId !== state.onTheClockPlayerId) {
      return withLastAction(state, {
        type: "requestHint",
        ignored: true,
        message: "Hint request ignored"
      });
    }

    return {
      ...state,
      hintsUsedThisQuestion: state.hintsUsedThisQuestion + 1,
      lastAction: { type: "requestHint" }
    };
  }

  public pass(state: GameState, event: PassEvent): GameState {
    if (!isAnswerable(state.phase) || event.playerId !== state.onTheClockPlayerId) {
      return withLastAction(state, {
        type: "pass",
        ignored: true,
        message: "Pass ignored"
      });
    }

    if (state.phase === "primary") {
      return this.openSteal(state, "pass");
    }

    return this.resolveWithAward(state, "nobody", "both_missed", { type: "pass" });
  }

  public manualOverride(state: GameState, award: ManualAward): GameState {
    return this.resolveWithAward(state, award, "manual_override", { type: "manualOverride" });
  }

  public reveal(state: GameState): GameState {
    if (!isAnswerable(state.phase)) {
      // Already revealed (resolved) or the game is over — don't re-resolve.
      return withLastAction(state, {
        type: "reveal",
        spokenText: `The answer was ${state.currentQuestion.answer}.`
      });
    }

    return this.resolveWithAward(state, "nobody", "both_missed", {
      type: "reveal",
      spokenText: `Nobody gets that one. The answer was ${state.currentQuestion.answer}.`
    });
  }

  public nextQuestion(state: GameState): GameState {
    if (state.phase === "complete") {
      return state;
    }

    const { questionsPerGame } = state.settings;
    if (questionsPerGame !== undefined && state.questionNumber >= questionsPerGame) {
      return this.completeGame(state);
    }

    const questionNumber = state.questionNumber + 1;
    const primaryPlayerId = primaryForQuestion(questionNumber, state.settings.firstPlayer);
    const currentQuestion = this.questionFor(questionNumber);
    this.rememberServedQuestion(currentQuestion.id);

    return {
      ...state,
      questionNumber,
      onTheClockPlayerId: primaryPlayerId,
      phase: "primary",
      currentQuestion,
      silentGuess: null,
      hintsUsedThisQuestion: 0,
      resolution: null,
      lastAction: {
        type: "nextQuestion",
        spokenText: `${playerName(state.players, primaryPlayerId)}, this one's for you. ${currentQuestion.prompt}`
      }
    };
  }

  private completeGame(state: GameState): GameState {
    return {
      ...state,
      phase: "complete",
      silentGuess: null,
      lastAction: {
        type: "gameOver",
        spokenText: closingBanter(state.players)
      }
    };
  }

  private applyPrimaryRuling(state: GameState, result: GradeResult): GameState {
    const { ruling, spokenText } = result;

    if (ruling === "correct") {
      return this.resolveWithAward(state, primaryForState(state), "primary_correct", {
        type: "submitAnswer",
        ruling,
        spokenText: spokenText ?? `Correct. ${playerName(state.players, primaryForState(state))} gets two.`
      });
    }

    if (ruling === "incorrect") {
      return this.openSteal(state, "submitAnswer", ruling, spokenText);
    }

    return withLastAction(state, {
      type: "submitAnswer",
      ruling,
      message: "Needs clarification",
      ...(spokenText ? { spokenText } : {})
    });
  }

  private applyStealRuling(state: GameState, result: GradeResult): GameState {
    const { ruling, spokenText } = result;

    if (ruling === "correct") {
      return this.resolveWithAward(state, state.onTheClockPlayerId, "steal_correct", {
        type: "submitAnswer",
        ruling,
        spokenText: spokenText ?? `Stolen clean. ${playerName(state.players, state.onTheClockPlayerId)} gets one.`
      });
    }

    if (ruling === "incorrect") {
      const reveal = `The answer was ${state.currentQuestion.answer}.`;
      return this.resolveWithAward(state, "nobody", "both_missed", {
        type: "submitAnswer",
        ruling,
        spokenText: spokenText ? `${spokenText} ${reveal}` : `Tough one. ${reveal}`
      });
    }

    return withLastAction(state, {
      type: "submitAnswer",
      ruling,
      message: "Needs clarification",
      ...(spokenText ? { spokenText } : {})
    });
  }

  private openSteal(state: GameState, actionType: string, ruling?: GradeRuling, hostLine?: string): GameState {
    const stealOffer = `${playerName(state.players, opponentOf(primaryForState(state)))}, want to steal it?`;
    const lastAction: NonNullable<GameState["lastAction"]> = {
      type: actionType,
      message: "Steal offered",
      spokenText: hostLine ? `${hostLine} ${stealOffer}` : stealOffer
    };

    if (ruling) {
      lastAction.ruling = ruling;
    }

    return {
      ...state,
      phase: "steal",
      onTheClockPlayerId: opponentOf(primaryForState(state)),
      resolution: null,
      lastAction
    };
  }

  private resolveWithAward(
    state: GameState,
    award: ManualAward | PlayerId,
    reason: ResolutionReason,
    lastAction: NonNullable<GameState["lastAction"]>
  ): GameState {
    const cleanedPlayers = removeExistingResolutionPoints(state);
    const awardedPoints = pointsForAward(state, award);
    const players = applyAwardedPoints(cleanedPlayers, awardedPoints);

    return {
      ...state,
      players,
      phase: "resolved",
      resolution: {
        questionNumber: state.questionNumber,
        reason,
        answerRevealed: true,
        award: normalizeAward(award),
        awardedPoints
      },
      lastAction
    };
  }

  private questionFor(questionNumber: number): TriviaQuestion {
    return this.activeQuestions[(questionNumber - 1) % this.activeQuestions.length]!;
  }

  private rememberServedQuestion(questionId: string): void {
    this.recentQuestionIds = [
      questionId,
      ...this.recentQuestionIds.filter((recentId) => recentId !== questionId)
    ].slice(0, this.recentQuestionLimit);
  }
}

export function buildQuestionOrder(
  questions: TriviaQuestion[],
  rng: Rng,
  recentQuestionIds: readonly string[] = []
): TriviaQuestion[] {
  if (questions.length === 0) {
    return [];
  }

  const order = shuffleQuestions(questions, rng);
  const recent = new Set(recentQuestionIds);
  if (recent.size === 0 || !recent.has(order[0]!.id)) {
    return order;
  }

  const swapIndex = order.findIndex((question) => !recent.has(question.id));
  if (swapIndex > 0) {
    [order[0], order[swapIndex]] = [order[swapIndex]!, order[0]!];
  }

  return order;
}

export function shuffleQuestions(questions: TriviaQuestion[], rng: Rng): TriviaQuestion[] {
  const shuffled = [...questions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }

  return shuffled;
}

export function primaryForQuestion(questionNumber: number, firstPlayer: PlayerId): PlayerId {
  const oddQuestion = questionNumber % 2 === 1;
  return oddQuestion ? firstPlayer : opponentOf(firstPlayer);
}

export function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "p1" ? "p2" : "p1";
}

export function winnerOf(players: [Player, Player]): PlayerId | "tie" {
  const [first, second] = players;
  if (first.score === second.score) {
    return "tie";
  }

  return first.score > second.score ? first.id : second.id;
}

function isAnswerable(phase: GameState["phase"]): boolean {
  return phase === "primary" || phase === "steal";
}

function closingBanter(players: [Player, Player]): string {
  const winner = winnerOf(players);
  const high = Math.max(players[0].score, players[1].score);
  const low = Math.min(players[0].score, players[1].score);

  if (winner === "tie") {
    return `That's the game — dead heat at ${high} apiece. We'll call it a draw. Tap New to run it back.`;
  }

  return `That's the game — ${playerName(players, winner)} takes it ${high} to ${low}. Tap New to run it back.`;
}

function createPlayers(playerNames: [string, string] = ["Jesse", "Linzee"]): [Player, Player] {
  return [
    { id: "p1", name: playerNames[0], score: 0 },
    { id: "p2", name: playerNames[1], score: 0 }
  ];
}

function playerName(players: [Player, Player], playerId: PlayerId): string {
  return players.find((player) => player.id === playerId)?.name ?? playerId;
}

function primaryForState(state: GameState): PlayerId {
  return primaryForQuestion(state.questionNumber, state.settings.firstPlayer);
}

function withLastAction(state: GameState, lastAction: NonNullable<GameState["lastAction"]>): GameState {
  return { ...state, lastAction };
}

function removeExistingResolutionPoints(state: GameState): [Player, Player] {
  if (!state.resolution || state.resolution.questionNumber !== state.questionNumber) {
    return clonePlayers(state.players);
  }

  return state.players.map((player) => ({
    ...player,
    score: player.score - (state.resolution?.awardedPoints[player.id] ?? 0)
  })) as [Player, Player];
}

function applyAwardedPoints(
  players: [Player, Player],
  awardedPoints: Partial<Record<PlayerId, number>>
): [Player, Player] {
  return players.map((player) => ({
    ...player,
    score: player.score + (awardedPoints[player.id] ?? 0)
  })) as [Player, Player];
}

function pointsForAward(state: GameState, award: ManualAward | PlayerId): Partial<Record<PlayerId, number>> {
  if (award === "nobody") {
    return {};
  }

  const primaryPlayerId = primaryForState(state);
  const stealPlayerId = opponentOf(primaryPlayerId);

  if (award === "tie") {
    return {
      [primaryPlayerId]: state.settings.primaryValue,
      [stealPlayerId]: state.settings.stealValue
    };
  }

  const playerId = award;
  return {
    [playerId]: playerId === primaryPlayerId ? state.settings.primaryValue : state.settings.stealValue
  };
}

function normalizeAward(award: ManualAward | PlayerId): ManualAward {
  return award;
}

function clonePlayers(players: [Player, Player]): [Player, Player] {
  return players.map((player) => ({ ...player })) as [Player, Player];
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${JSON.stringify(value)}`);
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof value === "object" && value !== null && "then" in value;
}
