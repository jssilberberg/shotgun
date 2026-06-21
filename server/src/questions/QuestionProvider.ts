import type { Difficulty, TriviaQuestion } from "../../../shared/src/index.ts";

export interface QuestionQuery {
  category?: string;
  difficulty?: Difficulty;
  count?: number;
}

export interface QuestionProvider {
  getQuestions(opts?: QuestionQuery): Promise<TriviaQuestion[]> | TriviaQuestion[];
}
