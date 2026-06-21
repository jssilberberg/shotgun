import type { TriviaQuestion } from "../game.ts";

export type GeneratedQuestion = TriviaQuestion & {
  source?: { provider: string; [key: string]: unknown };
};

export const GENERATED_QUESTIONS: GeneratedQuestion[] = [
  {
    id: "movie-001",
    prompt: "What 1975 movie made audiences afraid to go back in the water?",
    answer: "Jaws",
    category: "Movies",
    difficulty: "medium",
    verified: true,
    source: { provider: "seed" }
  },
  {
    id: "movie-002",
    prompt: "Who directed the 1994 film Pulp Fiction?",
    answer: "Quentin Tarantino",
    category: "Movies",
    difficulty: "medium",
    verified: true,
    source: { provider: "seed" }
  },
  {
    id: "movie-003",
    prompt: "In The Wizard of Oz, what color are Dorothy's slippers?",
    answer: "Ruby red",
    category: "Movies",
    difficulty: "easy",
    verified: true,
    source: { provider: "seed" }
  },
  {
    id: "movie-004",
    prompt: "What movie features the line, 'Here's looking at you, kid'?",
    answer: "Casablanca",
    category: "Movies",
    difficulty: "medium",
    verified: true,
    source: { provider: "seed" }
  },
  {
    id: "movie-005",
    prompt: "What 2019 film won Best Picture at the Academy Awards?",
    answer: "Parasite",
    category: "Movies",
    difficulty: "hard",
    verified: true,
    source: { provider: "seed" }
  },
  {
    id: "movie-006",
    prompt: "Who plays Forrest Gump in the 1994 film?",
    answer: "Tom Hanks",
    category: "Movies",
    difficulty: "easy",
    verified: true,
    source: { provider: "seed" }
  },
  {
    id: "movie-007",
    prompt: "What fictional metal powers much of Wakanda's technology in Black Panther?",
    answer: "Vibranium",
    category: "Movies",
    difficulty: "medium",
    verified: true,
    source: { provider: "seed" }
  },
  {
    id: "movie-008",
    prompt: "What is the name of the hobbit played by Elijah Wood in The Lord of the Rings films?",
    answer: "Frodo Baggins",
    category: "Movies",
    difficulty: "easy",
    verified: true,
    source: { provider: "seed" }
  },
  {
    id: "movie-009",
    prompt: "Which Studio Ghibli film features a bathhouse for spirits?",
    answer: "Spirited Away",
    category: "Movies",
    difficulty: "medium",
    verified: true,
    source: { provider: "seed" }
  },
  {
    id: "movie-010",
    prompt: "What 1982 sci-fi film asks whether Rick Deckard is a replicant?",
    answer: "Blade Runner",
    category: "Movies",
    difficulty: "hard",
    verified: true,
    source: { provider: "seed" }
  }
];
