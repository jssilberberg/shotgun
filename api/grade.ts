import type { GradeContext } from "../shared/src/index.ts";
import { loadServerConfig } from "../server/src/config/env.ts";
import { createLlmClient } from "../server/src/llm/createLlmClient.ts";
import { LlmHostGrader } from "../server/src/grading/llmHostGrader.ts";

// Stateless serverless grading function — the only backend piece. Holds no game
// state; runs the same LlmHostGrader the local server and tests use, keeping the
// API key server-side. Imports are side-effect-free (no top-level await), so this
// is safe as a Vercel function.
const config = loadServerConfig();
const llmClient = config.llm.apiKey ? createLlmClient(config) : undefined;
const grader = llmClient ? new LlmHostGrader({ client: llmClient, model: config.llm.model }) : undefined;

interface GradeRequestBody {
  answer?: unknown;
  groundTruth?: unknown;
  context?: GradeContext;
}

export default async function handler(
  request: { method?: string; body?: unknown },
  response: {
    setHeader(name: string, value: string): void;
    status(code: number): { json(body: unknown): void };
  }
): Promise<void> {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!grader) {
    response.status(503).json({ error: "LLM grading is not configured (no API key)" });
    return;
  }

  const body = parseBody(request.body);
  const { answer, groundTruth, context } = body;

  if (typeof answer !== "string" || typeof groundTruth !== "string" || !context) {
    response.status(400).json({ error: "answer, groundTruth, and context are required" });
    return;
  }

  try {
    const result = await grader.grade(answer, groundTruth, context);
    response.status(200).json({ result });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Grading failed"
    });
  }
}

function parseBody(body: unknown): GradeRequestBody {
  if (typeof body === "string") {
    try {
      return JSON.parse(body || "{}") as GradeRequestBody;
    } catch {
      return {};
    }
  }

  return (body ?? {}) as GradeRequestBody;
}
