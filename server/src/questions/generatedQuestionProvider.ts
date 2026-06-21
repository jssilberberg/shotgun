import type { Difficulty, TriviaQuestion } from "../../../shared/src/index.ts";
import type { LlmClient } from "../llm/LlmClient.ts";
import type { QuestionProvider, QuestionQuery } from "./QuestionProvider.ts";

export interface GeneratedQuestionProviderOptions {
  client: LlmClient;
  model: string;
}

export class GeneratedQuestionProvider implements QuestionProvider {
  private readonly client: LlmClient;
  private readonly model: string;

  public constructor(options: GeneratedQuestionProviderOptions) {
    this.client = options.client;
    this.model = options.model;
  }

  public async getQuestions(opts: QuestionQuery = {}): Promise<TriviaQuestion[]> {
    const raw = await this.client.completeJson({
      model: this.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Generate and verify five family-friendly trivia questions. Return JSON only."
        },
        {
          role: "user",
          content: JSON.stringify({
            contract: [
              {
                prompt: "single unambiguous question",
                answer: "fixed ground-truth answer",
                category: "category",
                difficulty: "easy|medium|hard",
                verified: true
              }
            ],
            instruction: "Discard ambiguous or unverifiable questions before returning."
          })
        }
      ]
    });

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Generated question response must be an array");
    }

    return parsed
      .map((question, index) => ({
        id: `generated-${index + 1}`,
        prompt: requireString(question, "prompt"),
        answer: requireString(question, "answer"),
        category: requireString(question, "category"),
        difficulty: requireDifficulty(question),
        verified: true
      }))
      .filter((question) => !opts.category || question.category === opts.category)
      .filter((question) => !opts.difficulty || question.difficulty === opts.difficulty)
      .slice(0, opts.count);
  }
}

function requireString(value: unknown, key: string): string {
  if (typeof value !== "object" || value === null || typeof (value as Record<string, unknown>)[key] !== "string") {
    throw new Error(`Generated question missing ${key}`);
  }

  return (value as Record<string, string>)[key]!;
}

function requireDifficulty(value: unknown): Difficulty {
  const difficulty = requireString(value, "difficulty");
  if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
    return difficulty;
  }

  throw new Error("Generated question has invalid difficulty");
}
