import test from "node:test";
import assert from "node:assert/strict";
import type { Difficulty, PlayerId, TriviaQuestion } from "../../shared/src/index.ts";
import { buildQuestionOrder, GameEngine } from "../src/engine/gameEngine.ts";
import { startGameFromProvider } from "../src/game/startGameFromProvider.ts";
import { MockGrader } from "../src/grading/mockGrader.ts";
import type { QuestionProvider, QuestionQuery } from "../src/questions/QuestionProvider.ts";

const questions: TriviaQuestion[] = [
  {
    id: "q1",
    prompt: "What is the capital of France?",
    answer: "Paris",
    category: "Geography",
    difficulty: "easy",
    verified: true
  },
  {
    id: "q2",
    prompt: "Who wrote Hamlet?",
    answer: "William Shakespeare",
    category: "Literature",
    difficulty: "easy",
    verified: true
  },
  {
    id: "q3",
    prompt: "What planet is known as the Red Planet?",
    answer: "Mars",
    category: "Science",
    difficulty: "easy",
    verified: true
  },
  {
    id: "q4",
    prompt: "How many days are in a leap year?",
    answer: "366",
    category: "General",
    difficulty: "medium",
    verified: true
  }
];

test("primary answers correctly (+2, turn alternates next question)", () => {
  const grader = new MockGrader(["correct"]);
  const engine = new GameEngine({ grader, questions });
  const started = engine.startGame();

  const resolved = engine.submitAnswer(started, {
    type: "submitAnswer",
    playerId: "p1",
    answer: "Paris"
  });

  assert.equal(resolved.phase, "resolved");
  assert.equal(scoreOf(resolved, "p1"), 2);
  assert.equal(scoreOf(resolved, "p2"), 0);
  assert.equal(resolved.resolution?.reason, "primary_correct");
  assert.equal(resolved.resolution?.answerRevealed, true);

  const next = engine.nextQuestion(resolved);
  assert.equal(next.questionNumber, 2);
  assert.equal(next.phase, "primary");
  assert.equal(next.onTheClockPlayerId, "p2");
  assert.equal(scoreOf(next, "p1"), 2);
});

test("primary wrong -> steal offered -> steal correct (+1 stealer)", () => {
  const grader = new MockGrader(["incorrect", "correct"]);
  const engine = new GameEngine({ grader, questions });
  const started = engine.startGame();

  const stealOffered = engine.submitAnswer(started, {
    type: "submitAnswer",
    playerId: "p1",
    answer: "Lyon"
  });

  assert.equal(stealOffered.phase, "steal");
  assert.equal(stealOffered.onTheClockPlayerId, "p2");
  assert.equal(scoreOf(stealOffered, "p1"), 0);
  assert.equal(scoreOf(stealOffered, "p2"), 0);

  const resolved = engine.submitAnswer(stealOffered, {
    type: "submitAnswer",
    playerId: "p2",
    answer: "Paris"
  });

  assert.equal(resolved.phase, "resolved");
  assert.equal(scoreOf(resolved, "p1"), 0);
  assert.equal(scoreOf(resolved, "p2"), 1);
  assert.equal(resolved.resolution?.reason, "steal_correct");
});

test("primary wrong -> steal wrong -> nobody scores, answer revealed", () => {
  const grader = new MockGrader(["incorrect", "incorrect"]);
  const engine = new GameEngine({ grader, questions });
  const started = engine.startGame();

  const stealOffered = engine.submitAnswer(started, {
    type: "submitAnswer",
    playerId: "p1",
    answer: "Lyon"
  });
  const resolved = engine.submitAnswer(stealOffered, {
    type: "submitAnswer",
    playerId: "p2",
    answer: "Madrid"
  });

  assert.equal(resolved.phase, "resolved");
  assert.equal(scoreOf(resolved, "p1"), 0);
  assert.equal(scoreOf(resolved, "p2"), 0);
  assert.equal(resolved.resolution?.reason, "both_missed");
  assert.equal(resolved.resolution?.answerRevealed, true);
});

test("primary passes -> steal offered", () => {
  const engine = new GameEngine({ grader: new MockGrader(), questions });
  const started = engine.startGame();

  const stealOffered = engine.pass(started, {
    type: "pass",
    playerId: "p1"
  });

  assert.equal(stealOffered.phase, "steal");
  assert.equal(stealOffered.onTheClockPlayerId, "p2");
  assert.equal(scoreOf(stealOffered, "p1"), 0);
  assert.equal(scoreOf(stealOffered, "p2"), 0);
});

test("requestHint loops in the active phase without scoring", () => {
  const engine = new GameEngine({ grader: new MockGrader(), questions });
  const started = engine.startGame();

  const hinted = engine.requestHint(started, {
    type: "requestHint",
    playerId: "p1"
  });

  assert.equal(hinted.phase, "primary");
  assert.equal(hinted.onTheClockPlayerId, "p1");
  assert.equal(hinted.hintsUsedThisQuestion, 1);
  assert.equal(scoreOf(hinted, "p1"), 0);
  assert.equal(scoreOf(hinted, "p2"), 0);
});

test("stealer passes -> nobody scores, answer revealed", () => {
  const grader = new MockGrader(["incorrect"]);
  const engine = new GameEngine({ grader, questions });
  const started = engine.startGame();
  const stealOffered = engine.submitAnswer(started, {
    type: "submitAnswer",
    playerId: "p1",
    answer: "Lyon"
  });

  const resolved = engine.pass(stealOffered, {
    type: "pass",
    playerId: "p2"
  });

  assert.equal(resolved.phase, "resolved");
  assert.equal(scoreOf(resolved, "p1"), 0);
  assert.equal(scoreOf(resolved, "p2"), 0);
  assert.equal(resolved.resolution?.reason, "both_missed");
  assert.equal(resolved.resolution?.answerRevealed, true);
});

test("out-of-turn input during primary phase is ignored", () => {
  const grader = new MockGrader(["correct"]);
  const engine = new GameEngine({ grader, questions });
  const started = engine.startGame();

  const ignored = engine.submitAnswer(started, {
    type: "submitAnswer",
    playerId: "p2",
    answer: "Paris"
  });

  assert.equal(ignored.phase, "primary");
  assert.equal(ignored.onTheClockPlayerId, "p1");
  assert.equal(scoreOf(ignored, "p1"), 0);
  assert.equal(scoreOf(ignored, "p2"), 0);
  assert.equal(ignored.lastAction?.ignored, true);
  assert.equal(grader.calls.length, 0);
});

test("needs clarification keeps the same player on the clock", () => {
  const grader = new MockGrader(["needs_clarification"]);
  const engine = new GameEngine({ grader, questions });
  const started = engine.startGame();

  const clarified = engine.submitAnswer(started, {
    type: "submitAnswer",
    playerId: "p1",
    answer: "The city with the tower"
  });

  assert.equal(clarified.phase, "primary");
  assert.equal(clarified.onTheClockPlayerId, "p1");
  assert.equal(clarified.lastAction?.ruling, "needs_clarification");
  assert.equal(scoreOf(clarified, "p1"), 0);
  assert.equal(scoreOf(clarified, "p2"), 0);
});

test("manual override changes the score correctly", () => {
  const grader = new MockGrader(["correct"]);
  const engine = new GameEngine({ grader, questions });
  const started = engine.startGame();
  const resolved = engine.submitAnswer(started, {
    type: "submitAnswer",
    playerId: "p1",
    answer: "Paris"
  });

  const overridden = engine.manualOverride(resolved, "nobody");

  assert.equal(overridden.phase, "resolved");
  assert.equal(scoreOf(overridden, "p1"), 0);
  assert.equal(scoreOf(overridden, "p2"), 0);
  assert.equal(overridden.resolution?.reason, "manual_override");
  assert.deepEqual(overridden.resolution?.awardedPoints, {});
});

test("alternation holds across several questions regardless of who scored", () => {
  const grader = new MockGrader([
    "incorrect",
    "correct",
    "correct",
    "incorrect",
    "incorrect",
    "correct"
  ]);
  const engine = new GameEngine({ grader, questions });

  let state = engine.startGame();
  assert.equal(state.questionNumber, 1);
  assert.equal(state.onTheClockPlayerId, "p1");

  state = engine.submitAnswer(state, { type: "submitAnswer", playerId: "p1", answer: "wrong" });
  state = engine.submitAnswer(state, { type: "submitAnswer", playerId: "p2", answer: "Paris" });
  assert.equal(scoreOf(state, "p2"), 1);

  state = engine.nextQuestion(state);
  assert.equal(state.questionNumber, 2);
  assert.equal(state.onTheClockPlayerId, "p2");

  state = engine.submitAnswer(state, { type: "submitAnswer", playerId: "p2", answer: "Shakespeare" });
  assert.equal(scoreOf(state, "p2"), 3);

  state = engine.nextQuestion(state);
  assert.equal(state.questionNumber, 3);
  assert.equal(state.onTheClockPlayerId, "p1");

  state = engine.submitAnswer(state, { type: "submitAnswer", playerId: "p1", answer: "Venus" });
  state = engine.submitAnswer(state, { type: "submitAnswer", playerId: "p2", answer: "Jupiter" });
  assert.equal(scoreOf(state, "p1"), 0);
  assert.equal(scoreOf(state, "p2"), 3);

  state = engine.nextQuestion(state);
  assert.equal(state.questionNumber, 4);
  assert.equal(state.onTheClockPlayerId, "p2");

  state = engine.submitAnswer(state, { type: "submitAnswer", playerId: "p2", answer: "366" });
  assert.equal(scoreOf(state, "p2"), 5);

  state = engine.nextQuestion(state);
  assert.equal(state.questionNumber, 5);
  assert.equal(state.onTheClockPlayerId, "p1");
});

test("game completes after questionsPerGame and ignores further answers", () => {
  const grader = new MockGrader(["correct", "correct"]);
  const engine = new GameEngine({ grader, questions, settings: { questionsPerGame: 2 } });

  let state = engine.startGame();
  state = engine.submitAnswer(state, { type: "submitAnswer", playerId: "p1", answer: "Paris" });
  assert.equal(scoreOf(state, "p1"), 2);

  state = engine.nextQuestion(state);
  assert.equal(state.questionNumber, 2);
  assert.equal(state.onTheClockPlayerId, "p2");

  state = engine.submitAnswer(state, { type: "submitAnswer", playerId: "p2", answer: "William Shakespeare" });
  assert.equal(scoreOf(state, "p2"), 2);

  const completed = engine.nextQuestion(state);
  assert.equal(completed.phase, "complete");
  assert.equal(completed.questionNumber, 2);
  assert.match(completed.lastAction?.spokenText ?? "", /that's the game/i);

  // A late answer after game over must not score or change phase.
  const afterComplete = engine.submitAnswer(completed, { type: "submitAnswer", playerId: "p1", answer: "Paris" });
  assert.equal(afterComplete.phase, "complete");
  assert.equal(afterComplete.lastAction?.ignored, true);
  assert.equal(scoreOf(afterComplete, "p1"), 2);
  assert.equal(scoreOf(afterComplete, "p2"), 2);

  // nextQuestion is idempotent once complete.
  assert.equal(engine.nextQuestion(completed).phase, "complete");
});

test("selected difficulty is passed to the provider and defaults to medium", async () => {
  const provider = new RecordingQuestionProvider();
  const engine = new GameEngine({
    grader: new MockGrader(),
    questions,
    rng: seededRng([0.2, 0.4, 0.6])
  });

  const defaultState = await startGameFromProvider(engine, provider);
  assert.equal(provider.calls[0]?.difficulty, "medium");
  assert.equal(defaultState.settings.difficulty, "medium");
  assert.equal(defaultState.currentQuestion.difficulty, "medium");

  const hardState = await startGameFromProvider(engine, provider, { difficulty: "hard" });
  assert.equal(provider.calls[1]?.difficulty, "hard");
  assert.equal(hardState.settings.difficulty, "hard");
  assert.equal(hardState.currentQuestion.difficulty, "hard");
});

test("shuffled question order is deterministic with a fixed rng", () => {
  const first = buildQuestionOrder(questions, seededRng([0.1, 0.8, 0.3, 0.6])).map((question) => question.id);
  const second = buildQuestionOrder(questions, seededRng([0.1, 0.8, 0.3, 0.6])).map((question) => question.id);

  assert.deepEqual(first, second);
  assert.notDeepEqual(first, questions.map((question) => question.id));
});

test("consecutive games with a large pool do not open on the same question", () => {
  const largePool = Array.from({ length: 8 }, (_, index): TriviaQuestion => ({
    id: `large-${index + 1}`,
    prompt: `Question ${index + 1}`,
    answer: `Answer ${index + 1}`,
    category: "General",
    difficulty: "medium",
    verified: true
  }));
  const engine = new GameEngine({
    grader: new MockGrader(),
    questions: largePool,
    rng: seededRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
  });

  const first = engine.startGame({ difficulty: "medium", questions: largePool });
  const second = engine.startGame({ difficulty: "medium", questions: largePool });

  assert.notEqual(first.currentQuestion.id, second.currentQuestion.id);
});

function scoreOf(state: { players: Array<{ id: PlayerId; score: number }> }, playerId: PlayerId): number {
  const player = state.players.find((candidate) => candidate.id === playerId);
  assert.ok(player);
  return player.score;
}

function seededRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length]!;
    index += 1;
    return value;
  };
}

class RecordingQuestionProvider implements QuestionProvider {
  public readonly calls: QuestionQuery[] = [];

  public getQuestions(opts: QuestionQuery = {}): TriviaQuestion[] {
    this.calls.push(opts);
    const difficulty: Difficulty = opts.difficulty ?? "medium";
    return [
      {
        id: `provider-${difficulty}`,
        prompt: `${difficulty} question`,
        answer: `${difficulty} answer`,
        category: "General",
        difficulty,
        verified: true
      }
    ];
  }
}
