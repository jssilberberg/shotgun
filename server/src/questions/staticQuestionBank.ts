import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Difficulty, TriviaQuestion } from "../../../shared/src/index.ts";
import type { QuestionProvider, QuestionQuery } from "./QuestionProvider.ts";

interface BankQuestion {
  prompt: string;
  answer: string;
  category: string;
  difficulty: Difficulty;
}

export class StaticQuestionBank implements QuestionProvider {
  private readonly path: string;
  private readonly logger: Pick<Console, "warn">;
  private readonly minimumQuestions: number;

  public constructor(path = defaultBankPath(), options: { logger?: Pick<Console, "warn">; minimumQuestions?: number } = {}) {
    this.path = path;
    this.logger = options.logger ?? console;
    this.minimumQuestions = options.minimumQuestions ?? 3;
  }

  public getQuestions(opts: QuestionQuery = {}): TriviaQuestion[] {
    const raw = JSON.parse(readFileSync(this.path, "utf8"));
    if (!Array.isArray(raw)) {
      throw new Error("Vetted question bank must be an array");
    }

    const questions = raw
      .map((question, index) => normalizeBankQuestion(question, index))
      .filter((question) => !opts.category || question.category === opts.category);

    if (!opts.difficulty) {
      return questions.slice(0, opts.count);
    }

    const preferred = questions.filter((question) => question.difficulty === opts.difficulty);
    const minimum = Math.min(opts.count ?? this.minimumQuestions, questions.length);

    if (preferred.length >= minimum) {
      return preferred.slice(0, opts.count);
    }

    this.logger.warn(
      `Static question bank has ${preferred.length} ${opts.difficulty} questions; including other difficulties to keep the game running.`
    );

    return [
      ...preferred,
      ...questions.filter((question) => question.difficulty !== opts.difficulty)
    ].slice(0, opts.count);
  }
}

function normalizeBankQuestion(question: unknown, index: number): TriviaQuestion {
  if (!isBankQuestion(question)) {
    throw new Error(`Invalid vetted question at index ${index}`);
  }

  return {
    id: `bank-${index + 1}`,
    prompt: question.prompt,
    answer: question.answer,
    category: question.category,
    difficulty: question.difficulty,
    verified: true
  };
}

function isBankQuestion(question: unknown): question is BankQuestion {
  return typeof question === "object"
    && question !== null
    && typeof (question as BankQuestion).prompt === "string"
    && typeof (question as BankQuestion).answer === "string"
    && typeof (question as BankQuestion).category === "string"
    && isDifficulty((question as BankQuestion).difficulty);
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

function defaultBankPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "vettedQuestionBank.json");
}
