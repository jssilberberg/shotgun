import type { Difficulty, TriviaQuestion } from "../../../shared/src/index.ts";
import type { QuestionProvider, QuestionQuery } from "./QuestionProvider.ts";
import type { TmdbClient, TmdbCredits, TmdbMovieDetails, TmdbMovieSummary } from "./TmdbClient.ts";

interface MovieBundle {
  summary: TmdbMovieSummary;
  details: TmdbMovieDetails;
  credits: TmdbCredits;
}

interface SuccessStats {
  attempts: number;
  correct: number;
}

// The answer is whatever movie each tmdbId resolves to, so a wrong id silently
// yields a wrong answer key. Extend only with TMDB-verified ids (ideally checked
// against a live key before shipping) to keep answer-key trust intact (PRD §6).
const BEST_PICTURE_WINNERS: Array<{ year: number; tmdbId: number }> = [
  { year: 1972, tmdbId: 238 },
  { year: 1994, tmdbId: 13 },
  { year: 1997, tmdbId: 597 },
  { year: 2000, tmdbId: 98 },
  { year: 2001, tmdbId: 453 },
  { year: 2003, tmdbId: 122 },
  { year: 2008, tmdbId: 12405 }
];

export class TmdbMovieSource implements QuestionProvider {
  private readonly client: TmdbClient;
  private readonly logger: Pick<Console, "log">;
  private readonly successStats = new Map<string, SuccessStats>();
  private questions: TriviaQuestion[] = [];

  public constructor(options: { client: TmdbClient; logger?: Pick<Console, "log"> }) {
    this.client = options.client;
    this.logger = options.logger ?? console;
  }

  public async preload(): Promise<void> {
    const [popular, obscure] = await Promise.all([
      this.fetchBundles("popularity.desc", 1, 12),
      this.fetchBundles("popularity.asc", 1, 10)
    ]);

    const bestPictureQuestions = await this.buildBestPictureQuestions();
    this.questions = dedupeById([
      ...popular.flatMap((bundle) => this.buildQuestionsForMovie(bundle, "easy")),
      ...popular.flatMap((bundle) => this.buildQuestionsForMovie(bundle, "medium")),
      ...obscure.flatMap((bundle) => this.buildQuestionsForMovie(bundle, "hard")),
      ...bestPictureQuestions
    ]);

    if (this.questions.length === 0) {
      throw new Error("TMDB preload produced no questions");
    }
  }

  public getQuestions(opts: QuestionQuery = {}): TriviaQuestion[] {
    return this.questions
      .filter((question) => !opts.category || question.category === opts.category)
      .filter((question) => !opts.difficulty || question.difficulty === opts.difficulty)
      .slice(0, opts.count);
  }

  public recordQuestionResult(questionId: string, wasCorrect: boolean): void {
    const current = this.successStats.get(questionId) ?? { attempts: 0, correct: 0 };
    const next = {
      attempts: current.attempts + 1,
      correct: current.correct + (wasCorrect ? 1 : 0)
    };
    this.successStats.set(questionId, next);
    this.logger.log(JSON.stringify({
      metric: "question_success_rate",
      questionId,
      attempts: next.attempts,
      correct: next.correct,
      successRate: next.correct / next.attempts
    }));
  }

  private async fetchBundles(
    sortBy: "popularity.desc" | "popularity.asc",
    page: number,
    count: number
  ): Promise<MovieBundle[]> {
    const summaries = (await this.client.discoverMovies({ sortBy, page })).slice(0, count);
    const bundles = await Promise.all(summaries.map(async (summary) => ({
      summary,
      details: await this.client.getMovieDetails(summary.id),
      credits: await this.client.getMovieCredits(summary.id)
    })));
    return bundles;
  }

  private buildQuestionsForMovie(bundle: MovieBundle, difficulty: Difficulty): TriviaQuestion[] {
    const questions: TriviaQuestion[] = [];
    const title = bundle.details.title || bundle.summary.title;
    const director = bundle.credits.crew.find((member) => member.job === "Director");
    const lead = bundle.credits.cast.find((member) => member.order === 0 && member.character.trim());
    const second = bundle.credits.cast.find((member) => member.order === 1 && member.character.trim());
    const supporting = bundle.credits.cast.find((member) => member.order >= 2 && member.character.trim());
    const releaseYear = releaseYearFrom(bundle.details.release_date ?? bundle.summary.release_date);

    if (difficulty === "easy" && director) {
      questions.push(movieQuestion({
        id: `tmdb-${bundle.details.id}-director`,
        prompt: `Who directed ${title}?`,
        answer: director.name,
        difficulty
      }));
    }

    if (difficulty === "easy" && lead) {
      questions.push(movieQuestion({
        id: `tmdb-${bundle.details.id}-lead-${slug(lead.character)}`,
        prompt: `Which actor played ${lead.character} in ${title}?`,
        answer: lead.name,
        difficulty
      }));
    }

    if (difficulty === "medium" && releaseYear) {
      questions.push(movieQuestion({
        id: `tmdb-${bundle.details.id}-release-year`,
        prompt: `What year was ${title} released?`,
        answer: releaseYear,
        difficulty
      }));
    }

    if (difficulty === "medium" && second) {
      questions.push(movieQuestion({
        id: `tmdb-${bundle.details.id}-second-${slug(second.character)}`,
        prompt: `Which actor played ${second.character} in ${title}?`,
        answer: second.name,
        difficulty
      }));
    }

    if (difficulty === "hard" && supporting) {
      questions.push(movieQuestion({
        id: `tmdb-${bundle.details.id}-supporting-${slug(supporting.character)}`,
        prompt: `Which actor played ${supporting.character} in ${title}?`,
        answer: supporting.name,
        difficulty
      }));
    }

    if (difficulty === "hard" && director) {
      questions.push(movieQuestion({
        id: `tmdb-${bundle.details.id}-director-hard`,
        prompt: `Who directed ${title}?`,
        answer: director.name,
        difficulty
      }));
    }

    if (difficulty === "hard" && releaseYear) {
      questions.push(movieQuestion({
        id: `tmdb-${bundle.details.id}-release-year-hard`,
        prompt: `What year was ${title} released?`,
        answer: releaseYear,
        difficulty
      }));
    }

    return questions;
  }

  private async buildBestPictureQuestions(): Promise<TriviaQuestion[]> {
    const questions: TriviaQuestion[] = [];

    for (const winner of BEST_PICTURE_WINNERS) {
      const details = await this.client.getMovieDetails(winner.tmdbId);
      questions.push(movieQuestion({
        id: `tmdb-best-picture-${winner.year}`,
        prompt: `Which movie won Best Picture for ${winner.year}?`,
        answer: details.title,
        difficulty: "medium"
      }));
    }

    return questions;
  }
}

function movieQuestion(args: {
  id: string;
  prompt: string;
  answer: string;
  difficulty: Difficulty;
}): TriviaQuestion {
  return {
    id: args.id,
    prompt: args.prompt,
    answer: args.answer,
    category: "Movies",
    difficulty: args.difficulty,
    verified: true
  };
}

function dedupeById(questions: TriviaQuestion[]): TriviaQuestion[] {
  const seen = new Set<string>();
  const result: TriviaQuestion[] = [];
  for (const question of questions) {
    if (seen.has(question.id)) {
      continue;
    }
    seen.add(question.id);
    result.push(question);
  }
  return result;
}

function releaseYearFrom(date: string | undefined): string | null {
  if (!date || !/^\d{4}/.test(date)) {
    return null;
  }

  return date.slice(0, 4);
}

function slug(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
