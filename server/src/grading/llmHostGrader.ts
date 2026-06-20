import type { GameState, PlayerId } from "../../../shared/src/index.ts";
import type { LlmClient, LlmMessage } from "../llm/LlmClient.ts";
import type { GradeContext, GradeResult, Grader } from "./Grader.ts";
import { parseHostGradeResult, type HostGradeResult } from "./hostSchema.ts";

export interface LlmHostGraderOptions {
  client: LlmClient;
  model: string;
}

const SYSTEM_PROMPT = [
  "You are Dash, a quick, warm, slightly cheeky family-friendly trivia host.",
  "Grade the player's answer semantically against the supplied GROUND_TRUTH_ANSWER only.",
  "Do not re-derive, change, or infer a different answer key from the player answer.",
  "Be generous with synonyms, partial answers, and phonetic/spoken approximations.",
  "If the player is challenging a ruling, defer quickly unless the answer is plainly unrelated.",
  "Keep spokenText short: one punchy sentence.",
  "Return only valid JSON with exactly: ruling, awardTo, spokenText."
].join(" ");

const REPAIR_PROMPT = [
  "Your previous response was malformed.",
  "Return only this exact JSON shape with no markdown and no extra keys:",
  "{\"ruling\":\"correct|incorrect|needs_clarification\",\"awardTo\":\"primary|steal|none\",\"spokenText\":\"...\"}"
].join(" ");

export class LlmHostGrader implements Grader {
  private readonly client: LlmClient;
  private readonly model: string;

  public constructor(options: LlmHostGraderOptions) {
    this.client = options.client;
    this.model = options.model;
  }

  public async grade(answer: string, groundTruth: string, context: GradeContext): Promise<GradeResult> {
    const { ruling, spokenText } = await this.gradeWithHostResult(answer, groundTruth, context);
    return { ruling, spokenText };
  }

  public async gradeWithHostResult(
    answer: string,
    groundTruth: string,
    context: GradeContext
  ): Promise<HostGradeResult> {
    const messages = buildMessages(answer, groundTruth, context);
    const first = await this.client.completeJson({
      model: this.model,
      messages,
      temperature: 0.2
    });

    const parsed = parseHostGradeResult(first);
    if (parsed) {
      return parsed;
    }

    const repaired = await this.client.completeJson({
      model: this.model,
      messages: [
        ...messages,
        { role: "assistant", content: first },
        { role: "user", content: REPAIR_PROMPT }
      ],
      temperature: 0
    });

    return parseHostGradeResult(repaired) ?? {
      ruling: "needs_clarification",
      awardTo: "none",
      spokenText: "I need one more try at hearing that."
    };
  }
}

export function buildMessages(answer: string, groundTruth: string, context: GradeContext): LlmMessage[] {
  return [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "grade_trivia_answer",
        structuredOutputContract: {
          ruling: "correct | incorrect | needs_clarification",
          awardTo: "primary | steal | none",
          spokenText: "short host line"
        },
        phase: context.state.phase,
        question: context.question.prompt,
        groundTruthAnswer: groundTruth,
        playerAnswer: answer,
        onTheClockPlayer: playerSnapshot(context.state, context.playerId),
        primaryPlayer: playerSnapshot(context.state, primaryPlayerId(context.state)),
        stealPlayer: context.state.phase === "steal"
          ? playerSnapshot(context.state, context.state.onTheClockPlayerId)
          : null,
        score: scoreSnapshot(context.state),
        instructions: [
          "Use groundTruthAnswer as fixed ground truth.",
          "Do not reveal the answer in spokenText on an incorrect primary answer.",
          "awardTo should be primary for a correct primary answer, steal for a correct steal answer, and none otherwise.",
          "Use needs_clarification for low-confidence speech-like answers."
        ]
      })
    }
  ];
}

export function validateHostGradeResult(raw: string): HostGradeResult | null {
  return parseHostGradeResult(raw);
}

function scoreSnapshot(state: GameState): Array<{ id: PlayerId; name: string; score: number }> {
  return state.players.map((player) => ({
    id: player.id,
    name: player.name,
    score: player.score
  }));
}

function playerSnapshot(state: GameState, playerId: PlayerId): { id: PlayerId; name: string } {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Unknown player: ${playerId}`);
  }

  return {
    id: player.id,
    name: player.name
  };
}

function primaryPlayerId(state: GameState): PlayerId {
  const firstPlayer = state.settings.firstPlayer;
  const oddQuestion = state.questionNumber % 2 === 1;
  return oddQuestion ? firstPlayer : opposite(firstPlayer);
}

function opposite(playerId: PlayerId): PlayerId {
  return playerId === "p1" ? "p2" : "p1";
}
