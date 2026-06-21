import type { Difficulty, TriviaQuestion } from "../game.ts";
import { GENERATED_QUESTIONS } from "./generatedBank.ts";

export interface QuestionQuery {
  difficulty?: Difficulty;
}

// Client-side question selection from the generated bank. Falls back to the full
// bank when a difficulty has too few questions, so a game can always start.
export function getQuestions(query: QuestionQuery = {}): TriviaQuestion[] {
  if (!query.difficulty) {
    return [...GENERATED_QUESTIONS];
  }

  const filtered = GENERATED_QUESTIONS.filter((question) => question.difficulty === query.difficulty);
  return filtered.length > 0 ? [...filtered] : [...GENERATED_QUESTIONS];
}
