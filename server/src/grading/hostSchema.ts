import type { GradeRuling } from "../../../shared/src/index.ts";

export type HostAwardTarget = "primary" | "steal" | "none";

export interface HostGradeResult {
  ruling: GradeRuling;
  awardTo: HostAwardTarget;
  spokenText: string;
}

const RULINGS = new Set(["correct", "incorrect", "needs_clarification"]);
const AWARD_TARGETS = new Set(["primary", "steal", "none"]);

export function parseHostGradeResult(raw: string): HostGradeResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const keys = Object.keys(parsed);
  if (keys.length !== 3 || !keys.includes("ruling") || !keys.includes("awardTo") || !keys.includes("spokenText")) {
    return null;
  }

  if (!RULINGS.has(String(parsed.ruling))) {
    return null;
  }

  if (!AWARD_TARGETS.has(String(parsed.awardTo))) {
    return null;
  }

  if (typeof parsed.spokenText !== "string" || parsed.spokenText.trim().length === 0) {
    return null;
  }

  return {
    ruling: parsed.ruling as GradeRuling,
    awardTo: parsed.awardTo as HostAwardTarget,
    spokenText: parsed.spokenText.trim()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
