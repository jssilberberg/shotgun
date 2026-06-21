import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadServerConfig } from "../src/config/env.ts";

test("loads question settings from the configured root env file path", () => {
  const envPath = writeTempEnv([
    "OPENAI_API_KEY=test-openai-key",
    "QUESTION_SOURCE=tmdb",
    "TMDB_API_KEY=test-tmdb-key"
  ]);

  const config = loadServerConfig({}, envPath);

  assert.equal(config.llm.apiKey, "test-openai-key");
  assert.equal(config.questions.source, "tmdb");
  assert.equal(config.questions.tmdbApiKey, "test-tmdb-key");
});

test("process env overrides values from the root env file", () => {
  const envPath = writeTempEnv([
    "QUESTION_SOURCE=tmdb",
    "TMDB_API_KEY=test-tmdb-key"
  ]);

  const config = loadServerConfig({ QUESTION_SOURCE: "static" }, envPath);

  assert.equal(config.questions.source, "static");
});

test("grader mode defaults to local and reads llm from the env", () => {
  const noGrader = loadServerConfig({}, writeTempEnv([]));
  assert.equal(noGrader.grader.mode, "local");

  const unknownGrader = loadServerConfig({ SHOTGUN_GRADER: "fancy" }, writeTempEnv([]));
  assert.equal(unknownGrader.grader.mode, "local");

  const fileGrader = loadServerConfig({}, writeTempEnv(["SHOTGUN_GRADER=llm"]));
  assert.equal(fileGrader.grader.mode, "llm");

  const envOverride = loadServerConfig({ SHOTGUN_GRADER: "llm" }, writeTempEnv(["SHOTGUN_GRADER=local"]));
  assert.equal(envOverride.grader.mode, "llm");
});

function writeTempEnv(lines: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "shotgun-env-test-"));
  const envPath = join(dir, ".env");
  writeFileSync(envPath, `${lines.join("\n")}\n`, "utf8");
  return envPath;
}
