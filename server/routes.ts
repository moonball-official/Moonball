import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertWaitlistEntrySchema } from "@shared/schema";
import { fetchLivePowerballData, getNextDrawDateISO } from "./powerball";
import { syncCycleState, seedHistoricalCycles } from "./cycle-sync";
import { buildOracleModel } from "./oracle-model";

const trackSchema = z.object({
  type: z.enum(["pageview", "event"]),
  path: z.string().max(200),
  visitorId: z.string().max(100),
  eventName: z.enum(["scroll_depth", "nav_click", "waitlist_signup", "calc_interaction"]).optional(),
  eventData: z.record(z.any()).optional(),
  referrer: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  entry.count++;
  return entry.count > 60;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.cycles.list.path, async (req, res) => {
    const cycles = await storage.getCycles();
    res.json(cycles);
  });

  app.get(api.cycles.get.path, async (req, res) => {
    const cycle = await storage.getCycle(Number(req.params.id));
    if (!cycle) {
      return res.status(404).json({ message: "Cycle not found" });
    }
    res.json(cycle);
  });

  app.get(api.jackpot.get.path, async (req, res) => {
    const data = await storage.getJackpotData();
    if (!data) {
      return res.status(404).json({ message: "Jackpot data not found" });
    }
    res.json(data);
  });

  app.get(api.powerball.live.path, async (req, res) => {
    try {
      await syncCycleState();

      const jackpotRow = await storage.getJackpotData();
      const cycleStart = jackpotRow?.cycleStart || (req.query.cycleStart as string) || "Feb 3, 2026";
      const liveData = await fetchLivePowerballData(cycleStart, jackpotRow?.estimated);

      const oracle = buildOracleModel(
        liveData.estimated,
        liveData.verificationSources,
        liveData.verificationStatus,
      );

      res.json({
        ...liveData,
        nextDrawISO: getNextDrawDateISO(),
        winner: jackpotRow?.winner || "No",
        cycleStart: jackpotRow?.cycleStart || cycleStart,
        moonPriceAtReset: jackpotRow?.moonPriceAtReset || 20,
        drawsInCurrentCycle: jackpotRow?.drawsWithoutWinner ?? liveData.drawsInCurrentCycle,
        verificationStatus: liveData.verificationStatus,
        verificationSources: liveData.verificationSources,
        verifiedAt: liveData.verifiedAt,
        oracle,
      });
    } catch (err) {
      console.error("Error in /api/powerball/live:", err);
      res.status(500).json({ message: "Failed to fetch live Powerball data" });
    }
  });

  app.post(api.analytics.track.path, async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      if (isRateLimited(clientIp)) {
        return res.status(429).json({ ok: false });
      }
      const parsed = trackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid tracking data" });
      }
      const { type, path, visitorId, eventName, eventData, referrer, userAgent } = parsed.data;
      if (type === "pageview") {
        await storage.recordPageView({ path, visitorId, referrer: referrer || null, userAgent: userAgent || null });
      } else if (type === "event" && eventName) {
        await storage.recordEvent({ eventName, eventData: eventData || null, visitorId, path });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("Analytics track error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.get(api.analytics.summary.path, async (req, res) => {
    const token = req.query.token as string;
    const validToken = process.env.ANALYTICS_TOKEN;
    if (!validToken || token !== validToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const days = parseInt(req.query.days as string) || 30;
      const summary = await storage.getAnalyticsSummary(days);
      res.json(summary);
    } catch (err) {
      console.error("Analytics summary error:", err);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  const waitlistSchema = insertWaitlistEntrySchema.extend({
    email: z.string().email("Please provide a valid email address.").transform(v => v.trim().toLowerCase()),
  });

  app.post(api.waitlist.join.path, async (req, res) => {
    try {
      const parsed = waitlistSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input." });
      }
      const normalizedEmail = parsed.data.email;
      try {
        await storage.addWaitlistEntry({ email: normalizedEmail });
      } catch (err: any) {
        if (err?.code === "23505") {
          const count = await storage.getWaitlistCount();
          return res.status(409).json({ message: "You're already on the waitlist!", count });
        }
        throw err;
      }
      const count = await storage.getWaitlistCount();
      res.json({ message: "You're on the list! We'll be in touch.", count });
    } catch (err) {
      console.error("Waitlist signup error:", err);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.get(api.waitlist.count.path, async (_req, res) => {
    const count = await storage.getWaitlistCount();
    res.json({ count });
  });

  app.post("/api/admin/repair-cycles", async (req, res) => {
    const token = req.query.token as string;
    const validToken = process.env.ANALYTICS_TOKEN;
    if (!validToken || token !== validToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const allCycles = await storage.getCycles();
      const active = allCycles.find((c) => c.isActive);
      if (!active) return res.json({ message: "No active cycle found", changed: false });

      const draws = (active.draws as { date: string; jackpot: number }[]) || [];
      const hasMay2 = draws.some((d) => d.date === "May 2" && d.jackpot <= 20);
      const hasApr29 = draws.some((d) => d.date === "Apr 29");

      if (!hasMay2 || !hasApr29) {
        return res.json({ message: `Active cycle C${active.id} does not need repair`, draws, changed: false });
      }

      const winnerMonth = "May 2026";
      const startLabel = active.label.split("–")[0]?.trim() || "Apr 2026";
      await storage.updateCycle(active.id, {
        isActive: false,
        winner: winnerMonth,
        peak: 20,
        label: `${startLabel} – ${winnerMonth}`,
      });

      const colors = ["#60A5FA", "#A78BFA", "#34D399", "#F5A623", "#FB923C", "#F472B6", "#22D3EE", "#A3E635"];
      const newColor = colors[allCycles.length % colors.length];
      await storage.createCycle({
        label: "May 2026 – Now",
        winner: null,
        peak: null,
        color: newColor,
        isActive: true,
        draws: [{ date: "May 2", jackpot: 20 }],
      });

      const jackpotRow = await storage.getJackpotData();
      if (jackpotRow) {
        await storage.updateJackpotData(jackpotRow.id, {
          cycleStart: "May 2, 2026",
          moonPriceAtReset: 20,
          winner: "Yes",
          drawsWithoutWinner: 1,
          jackpotGrowth: 0,
        });
      }

      // Also normalize every closed cycle's first draw to $20M
      const refreshed = await storage.getCycles();
      const fixed: number[] = [];
      for (const cycle of refreshed) {
        if (cycle.isActive) continue;
        const cDraws = (cycle.draws as { date: string; jackpot: number }[]) || [];
        if (cDraws.length > 0 && cDraws[0].jackpot > 20) {
          await storage.updateCycle(cycle.id, {
            draws: [{ ...cDraws[0], jackpot: 20 }, ...cDraws.slice(1)],
          });
          fixed.push(cycle.id);
        }
      }

      return res.json({
        message: `Repaired: closed C${active.id}, created new active cycle. Fixed opening draws for cycles: ${fixed.join(", ") || "none"}`,
        changed: true,
      });
    } catch (err) {
      console.error("Repair error:", err);
      return res.status(500).json({ message: "Repair failed", error: String(err) });
    }
  });

  return httpServer;
}

