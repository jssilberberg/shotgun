export default function handler(_request, response) {
  response.status(404).json({ error: "API route not found" });
}
