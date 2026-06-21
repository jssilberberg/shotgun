import type { Difficulty, GameEngine, GameState } from "../../../shared/src/index.ts";
import type { QuestionProvider } from "../questions/QuestionProvider.ts";

export interface ProviderStartGameOptions {
  playerNames?: [string, string];
  difficulty?: Difficulty;
}

export async function startGameFromProvider(
  engine: GameEngine,
  questionProvider: QuestionProvider,
  options: ProviderStartGameOptions = {}
): Promise<GameState> {
  const difficulty = options.difficulty ?? "medium";
  const questions = await questionProvider.getQuestions({ difficulty });
  const startOptions = {
    difficulty,
    questions
  };

  return engine.startGame(options.playerNames ? { ...startOptions, playerNames: options.playerNames } : startOptions);
}
