#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OUTPUT_PATH = process.env.QUESTION_BANK_OUTPUT ?? "shared/src/questions/generatedBank.ts";
const TARGET_COUNT = numberFromEnv("QUESTION_BANK_TARGET", 750);
const DISCOVER_PAGES = numberFromEnv("TMDB_DISCOVER_PAGES", 20);
const REQUEST_DELAY_MS = numberFromEnv("TMDB_REQUEST_DELAY_MS", 260);
const MIN_VOTE_COUNT = numberFromEnv("TMDB_MIN_VOTE_COUNT", 500);
const LANGUAGE = process.env.TMDB_LANGUAGE ?? "en-US";

if (!TMDB_API_KEY) {
  console.error("TMDB_API_KEY is required. Example: TMDB_API_KEY=... npm run generate:questions");
  process.exit(1);
}

const questionMap = new Map();
const movieIds = new Set();

for (let page = 1; page <= DISCOVER_PAGES && questionMap.size < TARGET_COUNT; page += 1) {
  const discover = await tmdb("/discover/movie", {
    include_adult: "false",
    include_video: "false",
    language: LANGUAGE,
    page: String(page),
    sort_by: "popularity.desc",
    "vote_count.gte": String(MIN_VOTE_COUNT),
    with_original_language: "en"
  });

  for (const movie of discover.results ?? []) {
    if (questionMap.size >= TARGET_COUNT) {
      break;
    }

    if (!movie.id || movieIds.has(movie.id)) {
      continue;
    }

    movieIds.add(movie.id);

    try {
      const details = await tmdb(`/movie/${movie.id}`, {
        append_to_response: "credits,release_dates",
        language: LANGUAGE
      });

      for (const question of questionsForMovie(details)) {
        if (questionMap.size >= TARGET_COUNT) {
          break;
        }

        const key = normalizeKey(question.prompt);
        if (!questionMap.has(key)) {
          questionMap.set(key, question);
        }
      }
    } catch (error) {
      console.warn(`Skipping movie ${movie.id}: ${error instanceof Error ? error.message : String(error)}`);
    }

    await delay(REQUEST_DELAY_MS);
  }

  console.log(`Page ${page}/${DISCOVER_PAGES}: ${questionMap.size} questions`);
}

const questions = [...questionMap.values()].sort((a, b) => a.id.localeCompare(b.id));
await writeQuestionModule(OUTPUT_PATH, questions);

console.log(`Wrote ${questions.length} questions to ${OUTPUT_PATH}`);

function questionsForMovie(movie) {
  const title = cleanTitle(movie.title);
  const year = releaseYear(movie.release_date);
  const directors = crewByJob(movie, "Director");
  const composers = crewByJob(movie, "Original Music Composer");
  const cast = Array.isArray(movie.credits?.cast) ? movie.credits.cast : [];
  const voteCount = Number(movie.vote_count ?? 0);
  const popularity = Number(movie.popularity ?? 0);
  const output = [];

  if (!title || !year || voteCount < MIN_VOTE_COUNT) {
    return output;
  }

  const baseDifficulty = inferDifficulty({ voteCount, popularity, year });
  const movieSource = {
    provider: "tmdb",
    movieId: movie.id,
    title,
    releaseYear: year
  };

  if (directors.length === 1) {
    output.push(question({
      movie,
      type: "director",
      prompt: `Who directed the ${year} film ${title}?`,
      answer: directors[0].name,
      difficulty: baseDifficulty,
      source: { ...movieSource, field: "credits.crew.Director" }
    }));
  }

  if (year) {
    output.push(question({
      movie,
      type: "release-year",
      prompt: `What year was ${title} released?`,
      answer: String(year),
      difficulty: baseDifficulty === "easy" ? "easy" : "medium",
      source: { ...movieSource, field: "release_date" }
    }));
  }

  const leadCast = cast
    .filter((member) => member?.name && member?.character && !isBadCharacterName(member.character))
    .slice(0, 5);

  for (const member of leadCast.slice(0, 2)) {
    output.push(question({
      movie,
      type: "actor-character",
      prompt: `In ${title}, which actor plays ${cleanCharacter(member.character)}?`,
      answer: member.name,
      difficulty: baseDifficulty === "easy" ? "medium" : baseDifficulty,
      source: { ...movieSource, field: "credits.cast.character", personId: member.id }
    }));
  }

  if (leadCast.length >= 2) {
    const [first, second] = leadCast;
    output.push(question({
      movie,
      type: "cast-pair-title",
      prompt: `Which ${year} film stars ${first.name} and ${second.name}?`,
      answer: title,
      difficulty: baseDifficulty,
      source: { ...movieSource, field: "credits.cast" }
    }));
  }

  if (composers.length === 1 && baseDifficulty !== "easy") {
    output.push(question({
      movie,
      type: "composer",
      prompt: `Who composed the music for ${title}?`,
      answer: composers[0].name,
      difficulty: "hard",
      source: { ...movieSource, field: "credits.crew.Original Music Composer" }
    }));
  }

  return output.filter(Boolean);
}

function question({ movie, type, prompt, answer, difficulty, source }) {
  const cleanPrompt = collapseWhitespace(prompt);
  const cleanAnswer = collapseWhitespace(answer);

  if (!cleanPrompt || !cleanAnswer || cleanPrompt.includes("undefined")) {
    return null;
  }

  return {
    id: `tmdb-${movie.id}-${type}`,
    prompt: cleanPrompt,
    answer: cleanAnswer,
    category: "Movies",
    difficulty,
    verified: true,
    source
  };
}

async function tmdb(endpoint, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url);

  if (response.status === 429) {
    const retryAfterSeconds = Number(response.headers.get("retry-after") ?? 3);
    await delay(Math.max(1, retryAfterSeconds) * 1000);
    return tmdb(endpoint, params);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TMDB ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

async function writeQuestionModule(outputPath, questions) {
  const fullPath = path.resolve(process.cwd(), outputPath);
  await mkdir(path.dirname(fullPath), { recursive: true });

  const contents = [
    "// Generated by scripts/generate-tmdb-question-bank.mjs.",
    "// Do not hand-edit this file; rerun the generator instead.",
    "import type { TriviaQuestion } from \"../game.ts\";",
    "",
    "export type GeneratedQuestion = TriviaQuestion & {",
    "  source?: { provider: string; [key: string]: unknown };",
    "};",
    "",
    `export const GENERATED_QUESTIONS: GeneratedQuestion[] = ${JSON.stringify(questions, null, 2)};`,
    ""
  ].join("\n");

  await writeFile(fullPath, contents, "utf8");
}

function crewByJob(movie, job) {
  return (movie.credits?.crew ?? [])
    .filter((member) => member?.job === job && member?.name)
    .map((member) => ({ id: member.id, name: collapseWhitespace(member.name) }))
    .filter((member, index, array) => array.findIndex((other) => other.name === member.name) === index);
}

function releaseYear(value) {
  const match = String(value ?? "").match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
}

function inferDifficulty({ voteCount, popularity, year }) {
  if (voteCount >= 10000 || popularity >= 80 || year <= 1995) {
    return "easy";
  }

  if (voteCount >= 2500 || popularity >= 30) {
    return "medium";
  }

  return "hard";
}

function cleanTitle(value) {
  return collapseWhitespace(String(value ?? "").replace(/\s+\(.*?\)$/u, ""));
}

function cleanCharacter(value) {
  return collapseWhitespace(String(value ?? "").split("/")[0].replace(/\(.*?\)/gu, ""));
}

function isBadCharacterName(value) {
  const character = cleanCharacter(value).toLowerCase();
  return (
    character.length < 2 ||
    character.includes("uncredited") ||
    character.includes("voice") ||
    character.includes("additional") ||
    character.includes("himself") ||
    character.includes("herself") ||
    character.includes("self")
  );
}

function collapseWhitespace(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function normalizeKey(value) {
  return collapseWhitespace(value).toLowerCase().replace(/[^a-z0-9]+/gu, " ");
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
