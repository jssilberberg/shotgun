import type { ServerConfig } from "../config/env.ts";
import type { LlmClient } from "./LlmClient.ts";
import { OpenAIResponsesClient } from "./openaiResponsesClient.ts";

export function createLlmClient(config: ServerConfig): LlmClient {
  if (config.llm.provider === "openai") {
    if (!config.llm.apiKey) {
      throw new Error("OPENAI_API_KEY is required for the OpenAI LLM provider");
    }

    return new OpenAIResponsesClient({ apiKey: config.llm.apiKey });
  }

  throw new Error(`Unsupported LLM provider: ${config.llm.provider}`);
}
