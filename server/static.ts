import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectRouteMeta } from "./meta";

const SPA_ROUTES = new Set(["/", "/technical-paper", "/analytics", "/protocol"]);

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { index: false }));

  const indexPath = path.resolve(distPath, "index.html");

  app.use("/{*path}", (req, res) => {
    const rawPath = req.path;

    // Redirect trailing-slash variants of known routes to canonical no-slash URL
    if (rawPath !== "/" && rawPath.endsWith("/")) {
      const noSlash = rawPath.replace(/\/+$/, "");
      if (SPA_ROUTES.has(noSlash)) {
        res.redirect(301, noSlash + req.originalUrl.slice(rawPath.length));
        return;
      }
    }

    const pathname = rawPath === "/" ? "/" : rawPath.replace(/\/+$/, "");
    const isKnown = SPA_ROUTES.has(pathname);
    const status = isKnown ? 200 : 404;

    try {
      const raw = fs.readFileSync(indexPath, "utf-8");
      const cleanPathname = req.originalUrl.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
      const html = injectRouteMeta(raw, cleanPathname);
      res.status(status).set({ "Content-Type": "text/html" }).end(html);
    } catch {
      res.status(status).sendFile(indexPath);
    }
  });
}
