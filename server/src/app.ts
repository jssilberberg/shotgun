import express from "express";
import type { GradeContext } from "../../shared/src/index.ts";
import { loadServerConfig } from "./config/env.ts";
import { createLlmClient } from "./llm/createLlmClient.ts";
import { LlmHostGrader } from "./grading/llmHostGrader.ts";

// The engine and game state now live in the client (single-device, client-authoritative).
// The only server responsibility is LLM grading, so the API key stays server-side.
// This endpoint is stateless — safe for both this local dev server and serverless.
const config = loadServerConfig();
const llmClient = config.llm.apiKey ? createLlmClient(config) : undefined;
const grader = llmClient ? new LlmHostGrader({ client: llmClient, model: config.llm.model }) : undefined;

const app = express();
app.use(express.json());

app.post("/api/grade", async (request, response) => {
  if (!grader) {
    response.status(503).json({ error: "LLM grading is not configured (no API key)" });
    return;
  }

  const { answer, groundTruth, context } = (request.body ?? {}) as {
    answer?: unknown;
    groundTruth?: unknown;
    context?: GradeContext;
  };

  if (typeof answer !== "string" || typeof groundTruth !== "string" || !context) {
    response.status(400).json({ error: "answer, groundTruth, and context are required" });
    return;
  }

  try {
    const result = await grader.grade(answer, groundTruth, context);
    response.json({ result });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Grading failed"
    });
  }
});

export default app;
