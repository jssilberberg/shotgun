import express from "express";
import type { Difficulty, GameEvent, GameState } from "../../shared/src/index.ts";
import { GameEngine } from "./engine/gameEngine.ts";
import { loadServerConfig } from "./config/env.ts";
import { LocalDemoGrader } from "./grading/localDemoGrader.ts";
import { LlmHostGrader } from "./grading/llmHostGrader.ts";
import type { Grader } from "./grading/Grader.ts";
import { startGameFromProvider } from "./game/startGameFromProvider.ts";
import { createLlmClient } from "./llm/createLlmClient.ts";
import { createQuestionProvider } from "./questions/createQuestionProvider.ts";

const PORT = Number(process.env.PORT ?? 3001);

const config = loadServerConfig();
const llmClient = config.llm.apiKey ? createLlmClient(config) : undefined;
const questionProvider = await createQuestionProvider(config, llmClient ? { llmClient } : {});
const grader = createGrader(config);
logStartupConfig(config);
const questions = await questionProvider.getQuestions({ difficulty: "medium" });
const engine = new GameEngine({ grader, questions });
let state: GameState = await startGameFromProvider(engine, questionProvider);

const app = express();
app.use(express.json());

app.get("/api/game/state", (_request, response) => {
  response.json({ state });
});

app.post("/api/game/new", async (request, response, next) => {
  try {
    state = await startGameFromProvider(engine, questionProvider, startOptionsFrom(request.body));
    response.json({ state });
  } catch (error) {
    next(error);
  }
});

app.post("/api/game/event", async (request, response, next) => {
  try {
    const event = request.body?.event as GameEvent | undefined;
    if (!event || typeof event.type !== "string") {
      response.status(400).json({ error: "A typed game event is required" });
      return;
    }

    if (event.type === "startGame") {
      state = await startGameFromProvider(engine, questionProvider, startOptionsFrom(event));
      response.json({ state });
      return;
    }

    state = await engine.handleEventAsync(state, event);
    response.json({ state });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  response.status(500).json({
    error: error instanceof Error ? error.message : "Unknown server error"
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Shotgun server listening on http://127.0.0.1:${PORT}`);
});

function createGrader(config: ReturnType<typeof loadServerConfig>): Grader {
  if (config.grader.mode !== "llm") {
    return new LocalDemoGrader();
  }

  if (!llmClient) {
    throw new Error("OPENAI_API_KEY is required when SHOTGUN_GRADER=llm");
  }

  return new LlmHostGrader({
    client: llmClient,
    model: config.llm.model
  });
}

function logStartupConfig(config: ReturnType<typeof loadServerConfig>): void {
  const graderDetail = config.grader.mode === "llm"
    ? `llm (Dash banter via ${config.llm.model})`
    : "local (exact-match demo grader; built-in host lines — set SHOTGUN_GRADER=llm for AI banter)";

  console.log("Shotgun config:");
  console.log(`  grader:          ${graderDetail}`);
  console.log(`  question source: ${config.questions.source}`);
  console.log(`  llm api key:     ${config.llm.apiKey ? "present" : "absent"}`);
}

function startOptionsFrom(value: { playerNames?: [string, string]; difficulty?: unknown } | undefined) {
  const difficulty = parseDifficulty(value?.difficulty);
  return {
    ...(value?.playerNames ? { playerNames: value.playerNames } : {}),
    ...(difficulty ? { difficulty } : {})
  };
}

function parseDifficulty(value: unknown): Difficulty | undefined {
  return value === "easy" || value === "medium" || value === "hard" ? value : undefined;
}
