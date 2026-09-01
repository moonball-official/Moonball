import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Cycle, JackpotData } from "@shared/schema";

export interface Draw {
  date: string;
  jackpot: number;
}

export interface CycleFrontend extends Omit<Cycle, 'draws'> {
  draws: Draw[];
}

export interface LivePowerballData {
  estimated: number;
  cashValue: number;
  nextDraw: string;
  nextDrawTime: string;
  lastDraw: string;
  winningNumbers: number[];
  powerball: number;
  multiplier: number;
  drawsInCurrentCycle: number;
  nextDrawISO: string;
  lastUpdated: string;
  winner: string;
  cycleStart: string;
  moonPriceAtReset: number;
  verificationStatus: "verified" | "unconfirmed";
  verificationSources: string[];
  verifiedAt: string;
  oracle: OracleModel;
}

export interface OracleModel {
  oracleValue: number;
  resetRisk: number;
  riskAdjustedValue: number;
  resetValue: number;
  expectedDropPct: number;
  consensusCount: number;
  totalSources: number;
  confidence: "High" | "Medium" | "Low";
  dataSources: { name: string; contributing: boolean }[];
}

export function useCycles() {
  return useQuery({
    queryKey: [api.cycles.list.path],
    queryFn: async () => {
      const res = await fetch(api.cycles.list.path);
      if (!res.ok) throw new Error("Failed to fetch cycles");
      return (await res.json()) as CycleFrontend[];
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}

export function useJackpotData() {
  return useQuery({
    queryKey: [api.jackpot.get.path],
    queryFn: async () => {
      const res = await fetch(api.jackpot.get.path);
      if (!res.ok) throw new Error("Failed to fetch jackpot data");
      return (await res.json()) as JackpotData;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}

export function useLivePowerball() {
  return useQuery({
    queryKey: [api.powerball.live.path],
    queryFn: async () => {
      const res = await fetch(api.powerball.live.path);
      if (!res.ok) throw new Error("Failed to fetch live Powerball data");
      return (await res.json()) as LivePowerballData;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}
