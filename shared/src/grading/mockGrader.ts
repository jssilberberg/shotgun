import type { GradeRuling } from "../game.ts";
import type { GradeContext, GradeResult, Grader } from "./Grader.ts";

export class MockGrader implements Grader {
  private readonly rulings: GradeRuling[];

  public readonly calls: Array<{
    answer: string;
    groundTruth: string;
    context: GradeContext;
  }> = [];

  public constructor(rulings: GradeRuling[] = []) {
    this.rulings = [...rulings];
  }

  public grade(answer: string, groundTruth: string, context: GradeContext): GradeResult {
    this.calls.push({ answer, groundTruth, context });

    const ruling = this.rulings.shift();
    if (!ruling) {
      throw new Error("MockGrader has no queued ruling");
    }

    return { ruling };
  }
}
