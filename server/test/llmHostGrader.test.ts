import test from "node:test";
import assert from "node:assert/strict";
import type { GameState, TriviaQuestion } from "../../shared/src/index.ts";
import type { LlmClient, LlmJsonRequest } from "../src/llm/LlmClient.ts";
import { LlmHostGrader, validateHostGradeResult } from "../src/grading/llmHostGrader.ts";

test("validates the exact host structured-output schema", () => {
  assert.deepEqual(
    validateHostGradeResult(JSON.stringify({
      ruling: "correct",
      awardTo: "primary",
      spokenText: "Boom. Two points."
    })),
    {
      ruling: "correct",
      awardTo: "primary",
      spokenText: "Boom. Two points."
    }
  );

  assert.equal(
    validateHostGradeResult(JSON.stringify({
      ruling: "correct",
      awardTo: "primary",
      spokenText: "Boom.",
      extra: true
    })),
    null
  );
  assert.equal(
    validateHostGradeResult(JSON.stringify({
      ruling: "close_enough",
      awardTo: "primary",
      spokenText: "Nope."
    })),
    null
  );
  assert.equal(validateHostGradeResult("not json"), null);
});

test("malformed output retries once with repair instruction", async () => {
  const client = new QueueLlmClient([
    "Correct! Give them points.",
    JSON.stringify({
      ruling: "correct",
      awardTo: "primary",
      spokenText: "Yep. That's the one."
    })
  ]);
  const grader = new LlmHostGrader({ client, model: "test-model" });

  const result = await grader.gradeWithHostResult("Paris", "Paris", {
    playerId: "p1",
    state: makeState(),
    question: question
  });

  assert.equal(result.ruling, "correct");
  assert.equal(result.awardTo, "primary");
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[1]!.messages.at(-1)!.content, /previous response was malformed/i);
});

test("malformed output falls back to needs_clarification after one failed repair", async () => {
  const client = new QueueLlmClient(["not json", "{\"ruling\":\"correct\"}"]);
  const grader = new LlmHostGrader({ client, model: "test-model" });

  const result = await grader.gradeWithHostResult("mumble", "Paris", {
    playerId: "p1",
    state: makeState(),
    question: question
  });

  assert.equal(result.ruling, "needs_clarification");
  assert.equal(result.awardTo, "none");
  assert.equal(client.calls.length, 2);
});

test("passes fixed ground truth through to the LLM without re-deriving it", async () => {
  const client = new QueueLlmClient([
    JSON.stringify({
      ruling: "incorrect",
      awardTo: "none",
      spokenText: "Not quite."
    })
  ]);
  const grader = new LlmHostGrader({ client, model: "test-model" });

  await grader.grade("London", "Paris", {
    playerId: "p1",
    state: makeState(),
    question: question
  });

  const userMessage = client.calls[0]!.messages.find((message) => message.role === "user");
  assert.ok(userMessage);

  const payload = JSON.parse(userMessage.content);
  assert.equal(payload.groundTruthAnswer, "Paris");
  assert.equal(payload.playerAnswer, "London");
  assert.equal(payload.question, question.prompt);
  assert.match(userMessage.content, /Use groundTruthAnswer as fixed ground truth/);
});

class QueueLlmClient implements LlmClient {
  public readonly calls: LlmJsonRequest[] = [];
  private readonly responses: string[];

  public constructor(responses: string[]) {
    this.responses = [...responses];
  }

  public async completeJson(request: LlmJsonRequest): Promise<string> {
    this.calls.push(request);
    const response = this.responses.shift();
    if (!response) {
      throw new Error("No queued LLM response");
    }

    return response;
  }
}

const question: TriviaQuestion = {
  id: "q1",
  prompt: "What is the capital of France?",
  answer: "Paris",
  category: "Geography",
  difficulty: "easy",
  verified: true
};

function makeState(): GameState {
  return {
    players: [
      { id: "p1", name: "Jesse", score: 0 },
      { id: "p2", name: "Linzee", score: 0 }
    ],
    questionNumber: 1,
    onTheClockPlayerId: "p1",
    phase: "primary",
    currentQuestion: question,
    silentGuess: null,
    hintsUsedThisQuestion: 0,
    settings: {
      primaryValue: 2,
      stealValue: 1,
      lockInEnabled: false,
      hintPenalty: "none",
      categoryPickEnabled: false,
      firstPlayer: "p1",
      difficulty: "medium",
      categories: []
    },
    resolution: null,
    lastAction: null
  };
}
