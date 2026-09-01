import { z } from 'zod';
import { insertCycleSchema, insertJackpotDataSchema, cycles, jackpotData } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  cycles: {
    list: {
      method: 'GET' as const,
      path: '/api/cycles' as const,
      responses: {
        200: z.array(z.custom<typeof cycles.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/cycles/:id' as const,
      responses: {
        200: z.custom<typeof cycles.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  jackpot: {
    get: {
      method: 'GET' as const,
      path: '/api/jackpot' as const,
      responses: {
        200: z.custom<typeof jackpotData.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    }
  },
  powerball: {
    live: {
      method: 'GET' as const,
      path: '/api/powerball/live' as const,
      responses: {
        200: z.object({
          estimated: z.number(),
          cashValue: z.number(),
          nextDraw: z.string(),
          nextDrawTime: z.string(),
          lastDraw: z.string(),
          winningNumbers: z.array(z.number()),
          powerball: z.number(),
          multiplier: z.number(),
          drawsInCurrentCycle: z.number(),
          nextDrawISO: z.string(),
          verificationStatus: z.enum(["verified", "unconfirmed"]),
          verificationSources: z.array(z.string()),
          verifiedAt: z.string(),
          oracle: z.object({
            oracleValue: z.number(),
            resetRisk: z.number(),
            riskAdjustedValue: z.number(),
            resetValue: z.number(),
            expectedDropPct: z.number(),
            consensusCount: z.number(),
            totalSources: z.number(),
            confidence: z.enum(["High", "Medium", "Low"]),
            dataSources: z.array(
              z.object({ name: z.string(), contributing: z.boolean() }),
            ),
          }),
        }),
        500: errorSchemas.internal,
      },
    }
  },
  analytics: {
    track: {
      method: 'POST' as const,
      path: '/api/analytics/track' as const,
      responses: {
        200: z.object({ ok: z.boolean() }),
        400: errorSchemas.validation,
      },
    },
    summary: {
      method: 'GET' as const,
      path: '/api/analytics/summary' as const,
      responses: {
        200: z.object({
          totalPageViews: z.number(),
          uniqueVisitors: z.number(),
          pageBreakdown: z.array(z.object({ path: z.string(), views: z.number() })),
          eventBreakdown: z.array(z.object({ eventName: z.string(), count: z.number() })),
          dailyViews: z.array(z.object({ date: z.string(), views: z.number(), unique: z.number() })),
          recentEvents: z.array(z.object({ eventName: z.string(), path: z.string(), createdAt: z.string() })),
        }),
      },
    },
  },
  waitlist: {
    join: {
      method: 'POST' as const,
      path: '/api/waitlist' as const,
      responses: {
        200: z.object({ message: z.string(), count: z.number() }),
        409: z.object({ message: z.string(), count: z.number() }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    count: {
      method: 'GET' as const,
      path: '/api/waitlist/count' as const,
      responses: {
        200: z.object({ count: z.number() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
