import app from "./app.ts";

const PORT = Number(process.env.PORT ?? 3001);

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Shotgun server listening on http://127.0.0.1:${PORT}`);
});
