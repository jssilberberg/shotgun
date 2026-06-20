import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type QuestionSource = "static" | "generated" | "tmdb";

export type GraderMode = "llm" | "local";

export interface ServerConfig {
  llm: {
    provider: "openai";
    model: string;
    apiKey: string;
  };
  questions: {
    source: QuestionSource;
    tmdbApiKey: string;
  };
  grader: {
    mode: GraderMode;
  };
}

export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
  envFilePath = defaultRootEnvPath()
): ServerConfig {
  const mergedEnv = {
    ...loadDotEnv(envFilePath),
    ...env
  };

  return {
    llm: {
      provider: "openai",
      model: mergedEnv.OPENAI_MODEL ?? "gpt-4.1-mini",
      apiKey: mergedEnv.OPENAI_API_KEY ?? ""
    },
    questions: {
      source: parseQuestionSource(mergedEnv.QUESTION_SOURCE),
      tmdbApiKey: mergedEnv.TMDB_API_KEY ?? ""
    },
    grader: {
      mode: parseGraderMode(mergedEnv.SHOTGUN_GRADER)
    }
  };
}

function parseQuestionSource(value: string | undefined): QuestionSource {
  if (value === "generated" || value === "tmdb") {
    return value;
  }

  return "static";
}

function parseGraderMode(value: string | undefined): GraderMode {
  return value === "llm" ? "llm" : "local";
}

function defaultRootEnvPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..", ".env");
}

function loadDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  const entries: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    entries[key] = value;
  }

  return entries;
}
