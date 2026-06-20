import type { ServerConfig } from "../config/env.ts";
import type { LlmClient } from "../llm/LlmClient.ts";
import type { QuestionProvider } from "./QuestionProvider.ts";
import { FetchTmdbClient, type TmdbClient } from "./TmdbClient.ts";
import { TmdbMovieSource } from "./TmdbMovieSource.ts";
import { GeneratedQuestionProvider } from "./generatedQuestionProvider.ts";
import { StaticQuestionBank } from "./staticQuestionBank.ts";

export interface CreateQuestionProviderOptions {
  llmClient?: LlmClient;
  tmdbClient?: TmdbClient;
  logger?: Pick<Console, "log" | "warn">;
}

export async function createQuestionProvider(
  config: ServerConfig,
  options: CreateQuestionProviderOptions = {}
): Promise<QuestionProvider> {
  const logger = options.logger ?? console;

  if (config.questions.source === "generated") {
    if (!options.llmClient) {
      logger.warn("Generated question source requested without an LLM client; falling back to static bank.");
      return new StaticQuestionBank();
    }

    return new GeneratedQuestionProvider({
      client: options.llmClient,
      model: config.llm.model
    });
  }

  if (config.questions.source === "tmdb") {
    if (!config.questions.tmdbApiKey && !options.tmdbClient) {
      logger.warn("TMDB question source requested without TMDB_API_KEY; falling back to static bank.");
      return new StaticQuestionBank();
    }

    const source = new TmdbMovieSource({
      client: options.tmdbClient ?? new FetchTmdbClient({ apiKey: config.questions.tmdbApiKey }),
      logger
    });

    try {
      await source.preload();
      return source;
    } catch (error) {
      logger.warn(`TMDB question source failed to preload; falling back to static bank. ${errorMessage(error)}`);
      return new StaticQuestionBank();
    }
  }

  return new StaticQuestionBank();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
