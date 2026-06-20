export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmJsonRequest {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
}

export interface LlmClient {
  completeJson(request: LlmJsonRequest): Promise<string>;
}
