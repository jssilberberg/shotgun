import type { GradeContext, GradeResult, Grader } from "../../../shared/src/index.ts";

// Used only when LLM grading is enabled (VITE_SHOTGUN_GRADER=llm). Forwards the
// answer + game context to the stateless /api/grade function so the API key stays
// server-side; the deterministic engine still runs in the browser.
export class RemoteGrader implements Grader {
  public async grade(answer: string, groundTruth: string, context: GradeContext): Promise<GradeResult> {
    const response = await fetch("/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer, groundTruth, context })
    });

    if (!response.ok) {
      throw new Error(`Grading failed with ${response.status}`);
    }

    const data = (await response.json()) as { result: GradeResult };
    return data.result;
  }
}
