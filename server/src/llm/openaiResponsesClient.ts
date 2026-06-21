import type { LlmClient, LlmJsonRequest } from "./LlmClient.ts";

export interface OpenAIResponsesClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class OpenAIResponsesClient implements LlmClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  public constructor(options: OpenAIResponsesClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async completeJson(request: LlmJsonRequest): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: request.model,
        input: request.messages,
        temperature: request.temperature ?? 0.2,
        text: {
          format: {
            type: "json_schema",
            name: "shotgun_host_grading",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["ruling", "awardTo", "spokenText"],
              properties: {
                ruling: {
                  type: "string",
                  enum: ["correct", "incorrect", "needs_clarification"]
                },
                awardTo: {
                  type: "string",
                  enum: ["primary", "steal", "none"]
                },
                spokenText: {
                  type: "string"
                }
              }
            }
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI Responses API failed with ${response.status}`);
    }

    const payload = await response.json();
    const outputText = extractOutputText(payload);
    if (!outputText) {
      throw new Error("OpenAI Responses API returned no output text");
    }

    return outputText;
  }
}

function extractOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const output = payload.output;
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
