/** Local-only fixture server for exercising the real bridge against localhost. */
import { createServer } from "http";

const port = Number(process.env.REHEARSAL_PORT ?? 5055);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("REHEARSAL_PORT must be a valid TCP port.");
}

const server = createServer((request, response) => {
  if (request.method !== "GET" || request.url !== "/api/powerball/live") {
    response.writeHead(404).end();
    return;
  }

  const now = Math.floor(Date.now() / 1_000) * 1_000;
  const sourceObservedAt = new Date(now - 1_000).toISOString();
  const lastDrawISO = new Date(now - 24 * 60 * 60 * 1_000).toISOString();
  const nextDrawISO = new Date(now + 24 * 60 * 60 * 1_000).toISOString();
  const payload = {
    estimated: 225,
    cashValue: 102,
    lastDrawISO,
    nextDrawISO,
    cycleId: "powerball-cycle:2026-09-01",
    drawId: `powerball-draw:${lastDrawISO}`,
    winner: "No",
    drawsInCurrentCycle: 8,
    verificationStatus: "verified",
    verificationSources: ["fixture-a.example", "fixture-b.example"],
    sourceObservations: [
      {
        source: "fixture-a.example",
        value: 224,
        cashValue: 101,
        fetchedAt: new Date(now - 2_000).toISOString(),
      },
      {
        source: "fixture-b.example",
        value: 226,
        cashValue: 102,
        fetchedAt: sourceObservedAt,
      },
    ],
    sourceObservedAt,
    verifiedAt: new Date(now).toISOString(),
  };

  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local rehearsal dashboard listening on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
