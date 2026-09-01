import { db } from "./db";
import {
  cycles,
  jackpotData,
  waitlistEntries,
  pageViews,
  analyticsEvents,
  type Cycle,
  type InsertCycle,
  type JackpotData,
  type InsertJackpotData,
  type WaitlistEntry,
  type InsertWaitlistEntry,
  type InsertPageView,
  type InsertAnalyticsEvent,
} from "@shared/schema";
import { eq, count, sql, gte, desc } from "drizzle-orm";

export interface IStorage {
  getCycles(): Promise<Cycle[]>;
  getCycle(id: number): Promise<Cycle | undefined>;
  createCycle(cycle: InsertCycle): Promise<Cycle>;
  updateCycle(id: number, data: Partial<InsertCycle>): Promise<Cycle>;
  getJackpotData(): Promise<JackpotData | undefined>;
  createJackpotData(data: InsertJackpotData): Promise<JackpotData>;
  updateJackpotData(id: number, data: Partial<InsertJackpotData>): Promise<JackpotData>;
  addWaitlistEntry(entry: InsertWaitlistEntry): Promise<WaitlistEntry>;
  getWaitlistCount(): Promise<number>;
  recordPageView(view: InsertPageView): Promise<void>;
  recordEvent(event: InsertAnalyticsEvent): Promise<void>;
  getAnalyticsSummary(days?: number): Promise<{
    totalPageViews: number;
    uniqueVisitors: number;
    pageBreakdown: { path: string; views: number }[];
    eventBreakdown: { eventName: string; count: number }[];
    dailyViews: { date: string; views: number; unique: number }[];
    recentEvents: { eventName: string; path: string; createdAt: Date }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async getCycles(): Promise<Cycle[]> {
    return await db.select().from(cycles).orderBy(cycles.id);
  }

  async getCycle(id: number): Promise<Cycle | undefined> {
    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, id));
    return cycle;
  }

  async createCycle(cycle: InsertCycle): Promise<Cycle> {
    const [newCycle] = await db.insert(cycles).values(cycle).returning();
    return newCycle;
  }

  async updateCycle(id: number, data: Partial<InsertCycle>): Promise<Cycle> {
    const [updated] = await db
      .update(cycles)
      .set(data)
      .where(eq(cycles.id, id))
      .returning();
    return updated;
  }

  async getJackpotData(): Promise<JackpotData | undefined> {
    const [data] = await db.select().from(jackpotData).limit(1);
    return data;
  }

  async createJackpotData(data: InsertJackpotData): Promise<JackpotData> {
    const [newData] = await db.insert(jackpotData).values(data).returning();
    return newData;
  }

  async updateJackpotData(id: number, data: Partial<InsertJackpotData>): Promise<JackpotData> {
    const [updated] = await db
      .update(jackpotData)
      .set(data)
      .where(eq(jackpotData.id, id))
      .returning();
    return updated;
  }

  async addWaitlistEntry(entry: InsertWaitlistEntry): Promise<WaitlistEntry> {
    const [newEntry] = await db.insert(waitlistEntries).values(entry).returning();
    return newEntry;
  }

  async getWaitlistCount(): Promise<number> {
    const [result] = await db.select({ value: count() }).from(waitlistEntries);
    return result.value;
  }

  async recordPageView(view: InsertPageView): Promise<void> {
    await db.insert(pageViews).values(view);
  }

  async recordEvent(event: InsertAnalyticsEvent): Promise<void> {
    await db.insert(analyticsEvents).values(event);
  }

  async getAnalyticsSummary(days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalResult] = await db
      .select({ value: count() })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since));

    const uniqueResult = await db
      .select({ value: sql<number>`count(distinct ${pageViews.visitorId})` })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since));

    const pageBreakdown = await db
      .select({ path: pageViews.path, views: count() })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since))
      .groupBy(pageViews.path)
      .orderBy(desc(count()));

    const eventBreakdown = await db
      .select({ eventName: analyticsEvents.eventName, count: count() })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, since))
      .groupBy(analyticsEvents.eventName)
      .orderBy(desc(count()));

    const dailyViews = await db
      .select({
        date: sql<string>`to_char(${pageViews.createdAt}, 'YYYY-MM-DD')`,
        views: count(),
        unique: sql<number>`count(distinct ${pageViews.visitorId})`,
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since))
      .groupBy(sql`to_char(${pageViews.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${pageViews.createdAt}, 'YYYY-MM-DD')`);

    const recentEvents = await db
      .select({
        eventName: analyticsEvents.eventName,
        path: analyticsEvents.path,
        createdAt: analyticsEvents.createdAt,
      })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, since))
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(50);

    return {
      totalPageViews: totalResult.value,
      uniqueVisitors: Number(uniqueResult[0]?.value ?? 0),
      pageBreakdown: pageBreakdown.map((r) => ({ path: r.path, views: r.views })),
      eventBreakdown: eventBreakdown.map((r) => ({ eventName: r.eventName, count: r.count })),
      dailyViews: dailyViews.map((r) => ({ date: r.date, views: r.views, unique: Number(r.unique) })),
      recentEvents,
    };
  }
}

export const storage = new DatabaseStorage();
