import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cycles = pgTable("cycles", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  winner: text("winner"), // null if active
  peak: integer("peak"),  // null if active
  color: text("color").notNull(),
  isActive: boolean("is_active").default(false),
  draws: jsonb("draws").notNull(), // Array of { date: string, jackpot: number }
});

export const jackpotData = pgTable("jackpot_data", {
  id: serial("id").primaryKey(),
  estimated: integer("estimated").notNull(),
  cashValue: text("cash_value").notNull(), // Store as text to keep precision or formatting if needed, or number
  nextDraw: text("next_draw").notNull(),
  nextDrawTime: text("next_draw_time").notNull(),
  lastDraw: text("last_draw").notNull(),
  winningNumbers: jsonb("winning_numbers").notNull(), // Array of numbers
  powerball: integer("powerball").notNull(),
  winner: text("winner").notNull(),
  cycleStart: text("cycle_start").notNull(),
  drawsWithoutWinner: integer("draws_without_winner").notNull(),
  jackpotGrowth: integer("jackpot_growth").notNull(),
  moonPriceAtReset: integer("moon_price_at_reset").notNull(),
  verificationStatus: text("verification_status").default("unconfirmed"),
  verifiedAt: timestamp("verified_at"),
  verificationSources: jsonb("verification_sources"),
});

export const waitlistEntries = pgTable("waitlist_entries", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pageViews = pgTable("page_views", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  visitorId: text("visitor_id").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  eventName: text("event_name").notNull(),
  eventData: jsonb("event_data"),
  visitorId: text("visitor_id").notNull(),
  path: text("path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCycleSchema = createInsertSchema(cycles);
export const insertJackpotDataSchema = createInsertSchema(jackpotData);
export const insertWaitlistEntrySchema = createInsertSchema(waitlistEntries).omit({ id: true, createdAt: true });
export const insertPageViewSchema = createInsertSchema(pageViews).omit({ id: true, createdAt: true });
export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({ id: true, createdAt: true });

export type Cycle = typeof cycles.$inferSelect;
export type InsertCycle = z.infer<typeof insertCycleSchema>;

export type JackpotData = typeof jackpotData.$inferSelect;
export type InsertJackpotData = z.infer<typeof insertJackpotDataSchema>;

export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type InsertWaitlistEntry = z.infer<typeof insertWaitlistEntrySchema>;

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = z.infer<typeof insertPageViewSchema>;

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
