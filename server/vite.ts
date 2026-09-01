import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { injectRouteMeta } from "./meta";

const viteLogger = createLogger();

const SPA_ROUTES = new Set(["/", "/technical-paper", "/analytics", "/protocol"]);

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const rawPath = req.path;

    // Redirect trailing-slash variants of known routes to canonical no-slash URL
    if (rawPath !== "/" && rawPath.endsWith("/")) {
      const noSlash = rawPath.replace(/\/+$/, "");
      if (SPA_ROUTES.has(noSlash)) {
        res.redirect(301, noSlash + req.originalUrl.slice(rawPath.length));
        return;
      }
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const url = req.originalUrl;
      let page = await vite.transformIndexHtml(url, template);
      const pathname = (req.originalUrl.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/");
      page = injectRouteMeta(page, pathname);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
