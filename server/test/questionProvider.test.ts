import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  TmdbClient,
  TmdbCredits,
  TmdbMovieDetails,
  TmdbMovieSummary
} from "../src/questions/TmdbClient.ts";
import { createQuestionProvider } from "../src/questions/createQuestionProvider.ts";
import { StaticQuestionBank } from "../src/questions/staticQuestionBank.ts";
import { TmdbMovieSource } from "../src/questions/TmdbMovieSource.ts";

test("TMDB movie source builds answers from structured data", async () => {
  const client = new MockTmdbClient();
  const source = new TmdbMovieSource({ client, logger: silentLogger });

  await source.preload();

  const easyQuestions = source.getQuestions({ category: "Movies", difficulty: "easy" });
  const directorQuestion = easyQuestions.find((question) => question.prompt === "Who directed Barbie?");

  assert.ok(directorQuestion);
  assert.equal(directorQuestion.answer, "Greta Gerwig");
  assert.equal(directorQuestion.verified, true);
  assert.equal(client.calls.some((call) => call.startsWith("model:")), false);
});

test("TMDB movie source supports hard questions from supporting cast data", async () => {
  const source = new TmdbMovieSource({ client: new MockTmdbClient(), logger: silentLogger });

  await source.preload();

  const hardQuestions = source.getQuestions({ category: "Movies", difficulty: "hard" });
  const castQuestion = hardQuestions.find((question) => question.prompt.includes("The Neighbor"));

  assert.ok(castQuestion);
  assert.equal(castQuestion.answer, "Obscure Support");
});

test("provider factory falls back to static bank when TMDB preload fails", async () => {
  const provider = await createQuestionProvider(
    {
      llm: {
        provider: "openai",
        model: "test-model",
        apiKey: ""
      },
      questions: {
        source: "tmdb",
        tmdbApiKey: "test-key"
      }
    },
    {
      tmdbClient: new FailingTmdbClient(),
      logger: silentLogger
    }
  );

  const questions = await provider.getQuestions({ count: 1 });

  assert.equal(questions[0]?.prompt, "What is the capital of France?");
  assert.equal(questions[0]?.answer, "Paris");
  assert.equal(questions[0]?.difficulty, "easy");
});

test("static question bank filters by difficulty and pads too-small pools", () => {
  const bankPath = join(mkdtempSync(join(tmpdir(), "shotgun-bank-")), "bank.json");
  writeFileSync(bankPath, JSON.stringify([
    { prompt: "Easy one?", answer: "Easy", category: "General", difficulty: "easy" },
    { prompt: "Medium one?", answer: "Medium", category: "General", difficulty: "medium" },
    { prompt: "Hard one?", answer: "Hard", category: "General", difficulty: "hard" }
  ]));
  const warnings: string[] = [];
  const bank = new StaticQuestionBank(bankPath, {
    logger: { warn(message: string) { warnings.push(message); } },
    minimumQuestions: 2
  });

  const easyOnly = bank.getQuestions({ difficulty: "easy", count: 1 });
  assert.deepEqual(easyOnly.map((question) => question.difficulty), ["easy"]);

  const hardWithFallback = bank.getQuestions({ difficulty: "hard" });
  assert.equal(hardWithFallback[0]?.difficulty, "hard");
  assert.ok(hardWithFallback.some((question) => question.difficulty !== "hard"));
  assert.equal(warnings.length, 1);
});

const silentLogger = {
  log(_message: string) {},
  warn(_message: string) {}
};

class MockTmdbClient implements TmdbClient {
  public readonly calls: string[] = [];

  public async discoverMovies(opts: { sortBy: "popularity.desc" | "popularity.asc"; page: number }): Promise<TmdbMovieSummary[]> {
    this.calls.push(`discover:${opts.sortBy}:${opts.page}`);
    return opts.sortBy === "popularity.desc"
      ? [{ id: 1, title: "Barbie", popularity: 400, release_date: "2023-07-19" }]
      : [{ id: 2, title: "Tiny Movie", popularity: 4, release_date: "1981-04-03" }];
  }

  public async getMovieDetails(movieId: number): Promise<TmdbMovieDetails> {
    this.calls.push(`details:${movieId}`);

    const details: Record<number, TmdbMovieDetails> = {
      1: { id: 1, title: "Barbie", popularity: 400, release_date: "2023-07-19", revenue: 1445638421 },
      2: { id: 2, title: "Tiny Movie", popularity: 4, release_date: "1981-04-03", revenue: 12345 },
      13: { id: 13, title: "Forrest Gump", popularity: 80, release_date: "1994-06-23" },
      597: { id: 597, title: "Titanic", popularity: 90, release_date: "1997-11-18" },
      453: { id: 453, title: "A Beautiful Mind", popularity: 30, release_date: "2001-12-14" },
      122: { id: 122, title: "The Lord of the Rings: The Return of the King", popularity: 95, release_date: "2003-12-17" },
      12405: { id: 12405, title: "Slumdog Millionaire", popularity: 35, release_date: "2008-11-12" }
    };

    return details[movieId] ?? { id: movieId, title: `Movie ${movieId}`, popularity: 1 };
  }

  public async getMovieCredits(movieId: number): Promise<TmdbCredits> {
    this.calls.push(`credits:${movieId}`);

    if (movieId === 1) {
      return {
        cast: [
          { name: "Margot Robbie", character: "Barbie", order: 0 },
          { name: "Ryan Gosling", character: "Ken", order: 1 },
          { name: "Michael Cera", character: "Allan", order: 2 }
        ],
        crew: [
          { name: "Greta Gerwig", job: "Director" }
        ]
      };
    }

    return {
      cast: [
        { name: "Obscure Lead", character: "The Lead", order: 0 },
        { name: "Obscure Support", character: "The Neighbor", order: 2 }
      ],
      crew: [
        { name: "Obscure Director", job: "Director" }
      ]
    };
  }
}

class FailingTmdbClient implements TmdbClient {
  public async discoverMovies(): Promise<TmdbMovieSummary[]> {
    throw new Error("TMDB down");
  }

  public async getMovieDetails(): Promise<TmdbMovieDetails> {
    throw new Error("TMDB down");
  }

  public async getMovieCredits(): Promise<TmdbCredits> {
    throw new Error("TMDB down");
  }
}
