import type { GradeContext, GradeResult, Grader } from "./Grader.ts";

export class LocalDemoGrader implements Grader {
  public grade(answer: string, groundTruth: string, _context: GradeContext): GradeResult {
    const ruling = normalize(answer) === normalize(groundTruth) ? "correct" : "incorrect";
    return { ruling };
  }
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ");
}
