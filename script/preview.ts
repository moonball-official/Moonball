import express from "express";
import fs from "node:fs";
import path from "node:path";
import { buildOracleModel } from "../server/oracle-model";
import { injectRouteMeta } from "../server/meta";

// A database-free design preview. Only public GET requests leave this process.
// Signup and analytics are simulated locally and are never stored or forwarded.
const app = express();
app.use(express.json());
const publicApis = new Set(["/api/powerball/live", "/api/cycles"]);
app.get("/api/{*path}", async (req, res) => {
  if (req.path === "/api/waitlist/count") return res.json({ count: 0 });
  if (!publicApis.has(req.path))
    return res.status(404).json({ message: "Not available in preview." });
  try {
    const upstream = await fetch(`https://www.moonball.info${req.path}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) throw new Error("Public feed unavailable");
    const data = await upstream.json();
    if (req.path === "/api/powerball/live")
      data.oracle = buildOracleModel(
        data.estimated,
        data.verificationSources,
        data.verificationStatus,
      );
    res.json(data);
  } catch {
    res
      .status(503)
      .json({ message: "Public feed unavailable. Please try again later." });
  }
});
app.post("/api/waitlist", (req, res) => {
  if (req.body?.email === "error@example.com")
    return res
      .status(503)
      .json({ message: "Preview error: please try another address." });
  res.json({
    message: "Preview complete — no email was saved or submitted.",
    count: 0,
  });
});
app.post("/api/analytics/track", (_req, res) => res.sendStatus(204));
const root = path.resolve("dist/public");
app.use(express.static(root, { index: false }));
app.use("/{*path}", (req, res) => {
  const page = injectRouteMeta(
    fs.readFileSync(path.join(root, "index.html"), "utf8"),
    req.originalUrl.split("?")[0],
  );
  res
    .type("html")
    .send(
      page.replace(
        '<div id="root">',
        '<aside style="background:#222a21;color:#e4e8dc;text-align:center;font:12px/1.5 system-ui;padding:7px 16px">Local design preview · Signups are simulated; no email is saved</aside><div id="root">',
      ),
    );
});
const port = Number(process.env.PORT || 4173);
app.listen(port, "127.0.0.1", () =>
  console.log(`Moonball design preview: http://127.0.0.1:${port}`),
);
