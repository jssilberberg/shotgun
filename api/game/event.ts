import { handleGameEvent } from "../../serverless/shotgunGame.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const event = body?.event;

    if (!event || typeof event.type !== "string") {
      response.status(400).json({ error: "A typed game event is required" });
      return;
    }

    response.status(200).json({ state: handleGameEvent(event) });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error"
    });
  }
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  if (typeof request.body === "string") {
    return JSON.parse(request.body || "{}");
  }

  let text = "";
  for await (const chunk of request) {
    text += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
  }

  return text ? JSON.parse(text) : {};
}
