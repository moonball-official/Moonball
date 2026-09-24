import { useState, useRef, useEffect, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import "./inner-pages.css";
import { Card } from "@/components/ui/GlowCard";
import { SectionLabel, StatRow } from "@/components/ui/StatRow";
import { MultiCycleChart } from "@/components/MultiCycleChart";
import { MiniChart } from "@/components/MiniChart";
import { WinningNumbers } from "@/components/WinningNumbers";
import { Countdown } from "@/components/Countdown";
import { PhaseIndicator, type CyclePhase } from "@/components/PhaseIndicator";
import {
  JACKPOT_DATA,
  T,
  MOON_V2,
  formatUsd,
  formatPct,
  referenceModel,
} from "@/lib/constants";
import { useLivePowerball, useCycles } from "@/hooks/use-moonball";
import { VERIFIED_HISTORICAL_CYCLES } from "@/lib/verified-powerball-history";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  usePageView,
  useTrackEvent,
  useScrollDepth,
} from "@/hooks/use-analytics";

function VerificationBadge({
  status,
  sources,
}: {
  status: "verified" | "unconfirmed";
  sources: string[];
}) {
  const isVerified = status === "verified";
  const label = isVerified ? "Verified ✓" : "Updating…";
  const color = isVerified ? "#34D399" : "#F5A623";
  const tipText = isVerified
    ? sources.join(" · ")
    : "Waiting for 2 sources to agree";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            data-testid="badge-verification-status"
            style={{
              marginTop: 4,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              background: `${color}15`,
              border: `1px solid ${color}40`,
              borderRadius: 6,
              padding: "2px 6px",
              cursor: "default",
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 8,
                color,
                letterSpacing: 0.3,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <span style={{ fontFamily: "'Nunito Sans'", fontSize: 10, color }}>
            {tipText}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function Dashboard() {
  const [chartMode, setChartMode] = useState("recent"); // "current" | "recent"
  const [activeCycleId, setActiveCycleId] = useState<number | null>(null);

  const [showAllCycles, setShowAllCycles] = useState(false);

  const [simJackpot, setSimJackpot] = useState("");
  const simCountRef = useRef(0);

  usePageView("/dashboard");
  useScrollDepth();
  const trackEvent = useTrackEvent();

  useEffect(() => {
    const jackpot = parseFloat(simJackpot);
    if (!isNaN(jackpot) && jackpot > 0) {
      simCountRef.current++;
      const ref = referenceModel(jackpot);
      trackEvent("calc_interaction", {
        action: "reference_explorer",
        jackpotM: jackpot,
        oracleValue: Math.round(ref.oracleValue * 100) / 100,
        resetRiskPct: Math.round(ref.resetRisk * 1000) / 10,
        simCount: simCountRef.current,
      });
    }
  }, [simJackpot, trackEvent]);

  const waitlistRef = useRef<HTMLDivElement>(null);

  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistMsg, setWaitlistMsg] = useState("");
  const [waitlistMsgType, setWaitlistMsgType] = useState<
    "success" | "error" | "info"
  >("info");

  const { data: waitlistCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/waitlist/count"],
  });

  const waitlistMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/waitlist", { email });
      return res.json();
    },
    onSuccess: (data: { message: string; count: number }) => {
      trackEvent("waitlist_signup", { count: data.count });
      setWaitlistMsg(data.message);
      setWaitlistMsgType("success");
      setWaitlistEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/waitlist/count"] });
    },
    onError: (err: Error) => {
      try {
        const jsonStr = err.message.replace(/^\d+:\s*/, "");
        const body = JSON.parse(jsonStr);
        setWaitlistMsg(
          body.message || "Something went wrong. Please try again.",
        );
        setWaitlistMsgType(body.count ? "info" : "error");
        if (body.count) {
          queryClient.invalidateQueries({ queryKey: ["/api/waitlist/count"] });
        }
      } catch {
        setWaitlistMsg("Something went wrong. Please try again.");
        setWaitlistMsgType("error");
      }
    },
  });

  const {
    data: liveData,
    isError: feedError,
    refetch: refreshFeed,
  } = useLivePowerball();
  const { data: apiCycles } = useCycles();

  const moonPriceAtReset =
    liveData?.moonPriceAtReset ?? JACKPOT_DATA.moonPriceAtReset;

  const d = liveData
    ? {
        ...JACKPOT_DATA,
        estimated: liveData.estimated ?? JACKPOT_DATA.estimated,
        cashValue: liveData.cashValue ?? JACKPOT_DATA.cashValue,
        nextDraw: liveData.nextDraw ?? JACKPOT_DATA.nextDraw,
        nextDrawTime: liveData.nextDrawTime ?? JACKPOT_DATA.nextDrawTime,
        lastDraw: liveData.lastDraw ?? JACKPOT_DATA.lastDraw,
        winningNumbers:
          liveData.winningNumbers.length > 0
            ? liveData.winningNumbers
            : JACKPOT_DATA.winningNumbers,
        powerball: liveData.powerball ?? JACKPOT_DATA.powerball,
        drawsWithoutWinner:
          liveData.drawsInCurrentCycle ?? JACKPOT_DATA.drawsWithoutWinner,
        jackpotGrowth:
          (liveData.estimated ?? JACKPOT_DATA.estimated) - moonPriceAtReset,
        winner: liveData.winner ?? JACKPOT_DATA.winner,
        moonPriceAtReset,
      }
    : JACKPOT_DATA;

  const o = liveData?.oracle;
  const sourceAgreement =
    o && liveData?.verificationStatus === "verified"
      ? `${o.consensusCount} of ${o.totalSources}`
      : "Pending";

  const cycles = useMemo(() => {
    if (apiCycles && apiCycles.length > 0) {
      // The first three database rows are legacy synthetic history. Use the
      // verified Powerball archive for completed cycles and retain live rows.
      const liveCycles = apiCycles
        .filter((c) => c.id >= 4)
        .map((c) => ({
          id: 1000 + c.id,
          label: c.winner ? c.label : "Current cycle",
          winner: c.winner,
          winnerDate: undefined as string | undefined,
          peak: c.peak,
          color: c.color,
          draws: (c.draws as { date: string; jackpot: number }[]) || [],
        }));
      return [...VERIFIED_HISTORICAL_CYCLES, ...liveCycles];
    }
    return [];
  }, [apiCycles]);

  const activeCycleData = useMemo(() => {
    return cycles.find((c) => !c.winner) || cycles[cycles.length - 1];
  }, [cycles]);

  const currentCycleDraws = useMemo(() => {
    return activeCycleData?.draws || [];
  }, [activeCycleData]);

  const recentChartCycles = useMemo(() => {
    const completed = cycles.filter((cycle) => cycle.winner).slice(-3);
    const current = cycles.find((cycle) => !cycle.winner);
    return current ? [...completed, current] : completed;
  }, [cycles]);

  useEffect(() => {
    if (cycles.length > 0 && activeCycleId === null) {
      setActiveCycleId(cycles[cycles.length - 1].id);
    }
  }, [cycles, activeCycleId]);

  const MAX_VISIBLE_CYCLES = 5;
  const visibleCycles = useMemo(() => {
    if (showAllCycles || cycles.length <= MAX_VISIBLE_CYCLES) return cycles;
    return cycles.slice(-MAX_VISIBLE_CYCLES);
  }, [cycles, showAllCycles]);
  const hiddenCount = cycles.length - visibleCycles.length;

  const nextDrawISO = liveData?.nextDrawISO;

  const [hoursToNext, setHoursToNext] = useState<number | null>(null);
  useEffect(() => {
    if (!nextDrawISO) return;
    const update = () => {
      const diff = new Date(nextDrawISO).getTime() - Date.now();
      setHoursToNext(diff / (1000 * 60 * 60));
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [nextDrawISO]);

  const DRAWING_WINDOW_HOURS = 6;

  const currentPhase: CyclePhase = useMemo(() => {
    if (d.winner === "Yes") return "WINNER";
    if (
      hoursToNext !== null &&
      hoursToNext >= 0 &&
      hoursToNext <= DRAWING_WINDOW_HOURS
    )
      return "DRAWING";
    if (currentCycleDraws.length <= 1 || d.estimated <= 20) return "RESET";
    return "GROWTH";
  }, [d.winner, d.estimated, currentCycleDraws.length, hoursToNext]);

  const phaseLabel = useMemo(() => {
    switch (currentPhase) {
      case "RESET":
        return "Reset";
      case "GROWTH":
        return "Growth";
      case "DRAWING":
        return "Drawing";
      case "WINNER":
        return "Winner";
    }
  }, [currentPhase]);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current;
    if (!el) return;
    const headerHeight =
      (document.querySelector("header") as HTMLElement)?.offsetHeight ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight;
    window.scrollTo({ top, behavior: "smooth" });
  };

  useEffect(() => {
    document.title = "Jackpot Dashboard | Moonball";
    window.scrollTo(0, 0);
  }, []);

  if (!liveData)
    return (
      <div className="moon-site moon-dashboard">
        <SiteHeader active="dashboard" />
        <main id="main" className="moon-inner-main moon-dashboard-loading">
          <p className="moon-eyebrow"><span className="moon-status-dot" /> LIVE DATA</p>
          <h1>Jackpot dashboard.</h1>
          <p role="status">{feedError ? "The live feed is temporarily unavailable. Please try again." : "Loading the latest jackpot data…"}</p>
          {feedError && <button className="moon-button" onClick={() => refreshFeed()}>Try again</button>}
        </main>
        <SiteFooter />
      </div>
    );

  return (
    <div className="moon-site moon-dashboard">
      <SiteHeader active="dashboard" />
      <main id="main" className="moon-inner-main moon-dashboard-main">
        <div className="moon-inner-intro moon-dashboard-intro">
          <div>
            <p className="moon-eyebrow"><span className="moon-status-dot" /> LIVE JACKPOT DATA</p>
            <h1>Jackpot dashboard<span className="moon-brand-dot">.</span></h1>
            <p>Follow the Powerball cycle, explore MOON's reference value, and see what the market is doing.</p>
          </div>
          <div className="moon-dashboard-highlight">
            <span>Estimated annuitized jackpot</span>
            <strong>${d.estimated}<small> million</small></strong>
            <span>Cash value: ${d.cashValue}M</span>
          </div>
        </div>

        {/* ── Oracle Reference Value ── */}
        <div>
          <Card glow style={{ marginBottom: 14, padding: "10px 14px" }}>
            <SectionLabel icon="🪙" text="MOON Market" as="h2" />
            {/* Market Price + Oracle Value side by side (market first) */}
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 8,
                margin: "-2px 0 8px",
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: `${T.blue}0D`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  border: `1px solid ${T.blue}26`,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Nunito Sans'",
                    fontSize: 8,
                    color: T.textMuted,
                    letterSpacing: 1.5,
                    marginBottom: 4,
                  }}
                >
                  MARKET PRICE
                </div>
                <div
                  data-testid="text-market-price"
                  style={{
                    fontFamily: "'Bebas Neue'",
                    fontSize: 34,
                    fontWeight: 400,
                    color: MOON_V2.marketLive ? "#fff" : T.blue,
                    letterSpacing: 1,
                    lineHeight: 1,
                  }}
                >
                  {MOON_V2.marketLive ? "—" : "Pre-launch"}
                </div>
                <div
                  style={{
                    fontFamily: "'Nunito Sans'",
                    fontSize: 8,
                    color: T.textMuted,
                    lineHeight: 1.3,
                    marginTop: 4,
                  }}
                >
                  Set by the DEX market
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: `${T.gold}0D`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  border: `1px solid ${T.gold}26`,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Nunito Sans'",
                    fontSize: 8,
                    color: T.textMuted,
                    letterSpacing: 1.5,
                    marginBottom: 4,
                  }}
                >
                  ORACLE VALUE
                </div>
                <div
                  data-testid="text-oracle-value-hero"
                  style={{
                    fontFamily: "'Bebas Neue'",
                    fontSize: 34,
                    fontWeight: 400,
                    color: T.gold,
                    letterSpacing: 1,
                    lineHeight: 1,
                  }}
                >
                  {o ? formatUsd(o.oracleValue) : "—"}
                </div>
                <div
                  style={{
                    fontFamily: "'Nunito Sans'",
                    fontSize: 8,
                    color: T.textMuted,
                    lineHeight: 1.3,
                    marginTop: 4,
                  }}
                >
                  Reference, not a price
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "'Nunito Sans'",
                  fontSize: 8,
                  color: T.textMuted,
                  letterSpacing: 0.5,
                }}
              >
                Updated: {liveData?.lastUpdated ?? "—"} ET
              </span>
              {liveData && (
                <VerificationBadge
                  status={liveData.verificationStatus}
                  sources={liveData.verificationSources}
                />
              )}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 6,
              }}
            >
              {[
                {
                  label: "Reference growth",
                  value: o
                    ? `+${Math.round(((o.oracleValue - MOON_V2.baseValue) / MOON_V2.baseValue) * 100)}%`
                    : "—",
                },
                {
                  label: "Reset Risk",
                  value: o ? formatPct(o.resetRisk) : "—",
                },
                { label: "Sources agree", value: sourceAgreement },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 8,
                    padding: "8px 6px",
                    textAlign: "center",
                    border: "1px solid rgba(255,255,255,0.03)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Nunito Sans'",
                      fontSize: 8,
                      color: T.textMuted,
                      letterSpacing: 1.5,
                      marginBottom: 3,
                    }}
                  >
                    {s.label.toUpperCase()}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Nunito Sans'",
                      fontSize: 12,
                      color: T.textPrimary,
                    }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Reference Value ── */}
        <Card style={{ marginBottom: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: `${T.gold}06`,
              borderRadius: 10,
              padding: "14px 16px",
              border: `1px solid ${T.gold}0D`,
            }}
          >
            <div style={{ textAlign: "center", flex: 1 }}>
              <div
                style={{
                  fontFamily: "'Nunito Sans'",
                  fontSize: 9,
                  color: T.textSecondary,
                  letterSpacing: 2,
                }}
              >
                JACKPOT
              </div>
              <div
                data-testid="text-jackpot"
                style={{
                  fontFamily: "'Bebas Neue'",
                  fontSize: 24,
                  fontWeight: 400,
                  color: "#fff",
                  marginTop: 4,
                  letterSpacing: 1,
                }}
              >
                ${d.estimated}M
              </div>
            </div>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: `${T.blue}18`,
                border: `1px solid ${T.blue}33`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                color: T.blue,
              }}
            >
              →
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div
                style={{
                  fontFamily: "'Nunito Sans'",
                  fontSize: 9,
                  color: T.textSecondary,
                  letterSpacing: 2,
                }}
              >
                ORACLE VALUE
              </div>
              <div
                data-testid="text-oracle-value"
                style={{
                  fontFamily: "'Bebas Neue'",
                  fontSize: 24,
                  fontWeight: 400,
                  color: T.gold,
                  marginTop: 4,
                  letterSpacing: 1,
                }}
              >
                {o ? formatUsd(o.oracleValue) : "—"}
              </div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div
                style={{
                  fontFamily: "'Nunito Sans'",
                  fontSize: 9,
                  color: T.textSecondary,
                  letterSpacing: 2,
                }}
              >
                RESET RISK
              </div>
              <div
                data-testid="text-reset-risk"
                style={{
                  fontFamily: "'Bebas Neue'",
                  fontSize: 24,
                  fontWeight: 400,
                  marginTop: 4,
                  letterSpacing: 1,
                  color:
                    o && o.resetRisk >= 0.5
                      ? "#F87171"
                      : o && o.resetRisk >= 0.25
                        ? T.gold
                        : "#34D399",
                }}
              >
                {o ? formatPct(o.resetRisk) : "—"}
              </div>
            </div>
          </div>

          {/* Market vs reference rows */}
          <div style={{ marginTop: 14 }}>
            <StatRow
              label="Risk-adjusted Value"
              value={o ? formatUsd(o.riskAdjustedValue) : "—"}
            />
            <StatRow
              label="Premium / Discount"
              value={MOON_V2.marketLive ? "—" : "Awaiting liquidity"}
            />
            <StatRow
              label="Market Efficiency"
              value={MOON_V2.marketLive ? "—" : "Awaiting liquidity"}
            />
            <StatRow
              label="Liquidity Pool Depth"
              value={MOON_V2.marketLive ? "—" : "Awaiting liquidity"}
            />
            <StatRow
              label="24h Trading Volume"
              value={MOON_V2.marketLive ? "—" : "Awaiting liquidity"}
            />
          </div>
        </Card>

        {/* ── Reference Value Explorer ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel icon="🧮" text="Reference Value Explorer" as="h2" />
          {(() => {
            const jackpot = parseFloat(simJackpot);
            const hasResult = !isNaN(jackpot) && jackpot > 0;
            const ref = hasResult ? referenceModel(jackpot) : null;
            const inputStyle = {
              flex: 1,
              background: "rgba(0,0,0,0.4)",
              border: `1px solid rgba(255,255,255,0.08)`,
              borderRadius: 8,
              padding: "10px 12px",
              fontFamily: "'Bebas Neue'",
              fontSize: 20,
              color: T.gold,
              letterSpacing: 1,
              outline: "none",
              width: "100%",
            } as const;
            const labelStyle = {
              fontFamily: "'Nunito Sans'",
              fontSize: 9,
              letterSpacing: 2,
              color: T.textSecondary,
              marginBottom: 6,
            } as const;
            return (
              <>
                <div>
                  <div style={labelStyle}>HYPOTHETICAL JACKPOT ($M)</div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        fontFamily: "'Bebas Neue'",
                        fontSize: 20,
                        color: T.textMuted,
                      }}
                    >
                      $
                    </span>
                    <input
                      data-testid="input-sim-jackpot"
                      type="number"
                      min="1"
                      placeholder="400"
                      value={simJackpot}
                      onChange={(e) => setSimJackpot(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
                {ref && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: "14px 16px",
                      borderRadius: 10,
                      background: "rgba(245,166,35,0.06)",
                      border: "1px solid rgba(245,166,35,0.15)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: "'Nunito Sans'",
                            fontSize: 9,
                            letterSpacing: 2,
                            color: T.textSecondary,
                            marginBottom: 4,
                          }}
                        >
                          ORACLE VALUE
                        </div>
                        <div
                          data-testid="text-sim-oracle-value"
                          style={{
                            fontFamily: "'Bebas Neue'",
                            fontSize: 28,
                            color: T.gold,
                            letterSpacing: 1,
                            lineHeight: 1,
                          }}
                        >
                          {formatUsd(ref.oracleValue)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontFamily: "'Nunito Sans'",
                            fontSize: 9,
                            letterSpacing: 2,
                            color: T.textSecondary,
                            marginBottom: 4,
                          }}
                        >
                          RESET RISK
                        </div>
                        <div
                          data-testid="text-sim-reset-risk"
                          style={{
                            fontFamily: "'Bebas Neue'",
                            fontSize: 28,
                            letterSpacing: 1,
                            lineHeight: 1,
                            color:
                              ref.resetRisk >= 0.5
                                ? "#F87171"
                                : ref.resetRisk >= 0.25
                                  ? T.gold
                                  : "#34D399",
                          }}
                        >
                          {formatPct(ref.resetRisk)}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        paddingTop: 10,
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontFamily: "'Nunito Sans'",
                            fontSize: 9,
                            letterSpacing: 2,
                            color: T.textSecondary,
                            marginBottom: 4,
                          }}
                        >
                          RISK-ADJUSTED VALUE
                        </div>
                        <div
                          data-testid="text-sim-risk-adjusted"
                          style={{
                            fontFamily: "'Bebas Neue'",
                            fontSize: 28,
                            color: "#fff",
                            letterSpacing: 1,
                            lineHeight: 1,
                          }}
                        >
                          {formatUsd(ref.riskAdjustedValue)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div
                  style={{
                    marginTop: 14,
                    textAlign: "center",
                    fontFamily: "'Rajdhani'",
                    fontSize: 12,
                    color: "rgba(160,170,190,0.85)",
                  }}
                >
                  Reference values only — what the market does is up to traders.{" "}
                  <a
                    data-testid="link-sim-waitlist"
                    href="#waitlist"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToRef(waitlistRef);
                    }}
                    style={{
                      color: T.gold,
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    Join the waitlist.
                  </a>
                </div>
              </>
            );
          })()}
        </Card>

        {/* ── Chart ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel icon="📈" text="Jackpot History" as="h2" />

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
            {["This Cycle", "Recent 4 Cycles"].map((t, i) => {
              const mode = i === 0 ? "current" : "recent";
              const isActive = chartMode === mode;
              return (
                <button
                  key={i}
                  onClick={() => setChartMode(mode)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    background: isActive ? `${T.gold}12` : "transparent",
                    border: `1px solid ${
                      isActive ? `${T.gold}28` : "rgba(255,255,255,0.04)"
                    }`,
                    borderRadius: i === 0 ? "8px 0 0 8px" : "0 8px 8px 0",
                    fontFamily: "'Nunito Sans'",
                    fontSize: 10,
                    letterSpacing: 1,
                    color: isActive ? T.gold : T.textMuted,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {t.toUpperCase()}
                </button>
              );
            })}
          </div>

          {chartMode === "current" ? (
            <MiniChart data={currentCycleDraws} />
          ) : (
            <MultiCycleChart
              cycles={recentChartCycles}
              activeCycleId={
                recentChartCycles.some((cycle) => cycle.id === activeCycleId)
                  ? activeCycleId!
                  : recentChartCycles[recentChartCycles.length - 1]?.id ?? 1
              }
              onSelectCycle={setActiveCycleId}
            />
          )}
          <p className="moon-history-source">
            Historical jackpots and winner dates: <a href="https://www.powerball.com/media-center" target="_blank" rel="noreferrer">Powerball records ↗</a>
          </p>
        </Card>

        {/* ── Countdown ── */}
        <Card glow style={{ marginBottom: 14 }}>
          <SectionLabel icon="⏱" text="Next Drawing" as="h2" />
          <Countdown targetISO={nextDrawISO} />
          <div
            style={{
              textAlign: "center",
              marginTop: 12,
              fontFamily: "'Nunito Sans'",
              fontSize: 11,
              color: T.textMuted,
              letterSpacing: 0.5,
            }}
          >
            {d.nextDraw} — {d.nextDrawTime}
          </div>
        </Card>

        {/* ── Draw Info ── */}
        <Card glow style={{ marginBottom: 14 }}>
          <SectionLabel icon="🎰" text="Latest Draw" as="h2" />

          {/* Draw date banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid rgba(255,255,255,0.05)`,
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Nunito Sans'",
                  fontSize: 9,
                  letterSpacing: 2,
                  color: T.textSecondary,
                  marginBottom: 2,
                }}
              >
                DRAW DATE
              </div>
              <div
                style={{
                  fontFamily: "'Montserrat'",
                  fontSize: 14,
                  fontWeight: 700,
                  color: T.textPrimary,
                }}
              >
                {d.lastDraw}
              </div>
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue'",
                fontSize: 14,
                letterSpacing: 1,
                padding: "4px 12px",
                borderRadius: 4,
                background:
                  d.winner === "No"
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(52,211,153,0.12)",
                border: `1px solid ${d.winner === "No" ? "rgba(239,68,68,0.25)" : "rgba(52,211,153,0.25)"}`,
                color: d.winner === "No" ? "#F87171" : "#34D399",
              }}
            >
              {d.winner === "No" ? "NO WINNER" : "WINNER"}
            </div>
          </div>

          {/* Winning numbers label */}
          <div
            style={{
              fontFamily: "'Nunito Sans'",
              fontSize: 9,
              letterSpacing: 2,
              color: T.textSecondary,
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            WINNING NUMBERS
          </div>

          {/* Enhanced winning number balls */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              padding: "8px 0 16px",
            }}
          >
            {d.winningNumbers.map((n: number, i: number) => (
              <div
                key={i}
                data-testid={`ball-number-${i}`}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.1) 0%, rgba(59,130,246,0.08) 60%, rgba(59,130,246,0.02) 100%)",
                  border: `1.5px solid rgba(59,130,246,0.3)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Bebas Neue'",
                  fontSize: 18,
                  color: "#e0e8f0",
                  boxShadow:
                    "0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
                  letterSpacing: 0.5,
                }}
              >
                {n}
              </div>
            ))}
            {/* Powerball */}
            <div
              data-testid="ball-powerball"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.15) 0%, rgba(245,166,35,0.2) 60%, rgba(245,166,35,0.05) 100%)`,
                border: `1.5px solid ${T.gold}66`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Bebas Neue'",
                fontSize: 18,
                fontWeight: 400,
                color: T.gold,
                boxShadow: `0 2px 8px rgba(0,0,0,0.3), 0 0 12px rgba(245,166,35,0.15), inset 0 1px 0 rgba(255,255,255,0.08)`,
                letterSpacing: 0.5,
              }}
            >
              {d.powerball}
            </div>
          </div>

          {/* Labels under the balls */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              paddingBottom: 6,
            }}
          >
            <div
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 8,
                letterSpacing: 1.5,
                color: T.textMuted,
                width:
                  40 * d.winningNumbers.length +
                  10 * (d.winningNumbers.length - 1),
                textAlign: "center",
              }}
            >
              WHITE BALLS
            </div>
            <div
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 8,
                letterSpacing: 1.5,
                color: T.goldDark,
                width: 40,
                textAlign: "center",
              }}
            >
              PB
            </div>
          </div>
        </Card>

        {/* ── Oracle Reference ── */}
        <div>
          <Card style={{ marginBottom: 14 }} glowColor="blue">
            <SectionLabel icon="⛓" text="Oracle Reference" as="h2" />
            <StatRow
              label="Headline Value"
              value={o ? formatUsd(o.oracleValue) : "—"}
              accent
              accentColor="blue"
            />
            <StatRow
              label="Risk-adjusted Value"
              value={o ? formatUsd(o.riskAdjustedValue) : "—"}
            />
            <StatRow
              label="Reset Risk (next draw)"
              value={o ? formatPct(o.resetRisk) : "—"}
              accent
              accentColor={o && o.resetRisk >= 0.5 ? "red" : "gold"}
            />
            <StatRow
              label="Sources agreeing"
              value={sourceAgreement}
            />
            {o && (
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {o.dataSources.map((src) => {
                  const contributing = liveData?.verificationStatus === "verified" && src.contributing;
                  return <span
                    key={src.name}
                    data-testid={`source-${src.name}`}
                    style={{
                      fontFamily: "'Nunito Sans'",
                      fontSize: 9,
                      letterSpacing: 0.3,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: contributing
                        ? "rgba(52,211,153,0.12)"
                        : "rgba(255,255,255,0.03)",
                      border: `1px solid ${contributing ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.08)"}`,
                      color: contributing ? "#34D399" : T.textMuted,
                    }}
                  >
                    {contributing ? "● " : "○ "}
                    {src.name}
                  </span>;
                })}
              </div>
            )}
            <p
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 10,
                color: T.textMuted,
                lineHeight: 1.6,
                marginTop: 12,
              }}
            >
              The oracle publishes a reference value only — it does not set or
              defend the market price. A value is confirmed once at least two
              independent sources agree on the jackpot.
            </p>
          </Card>
        </div>

        {/* ── Reset Cycle ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel icon="🔄" text="Jackpot Reset Cycle" as="h2" />
          <PhaseIndicator activePhase={currentPhase} />
          <div style={{ marginTop: 16 }}>
            <StatRow label="Current Phase" value={phaseLabel} accent />
            <StatRow label="Cycle Start" value={d.cycleStart} />
            <StatRow
              label="Draws w/o Winner"
              value={String(d.drawsWithoutWinner)}
            />
            <StatRow
              label="Jackpot Growth"
              value={
                d.jackpotGrowth >= 0
                  ? `+$${d.jackpotGrowth}M`
                  : `-$${Math.abs(d.jackpotGrowth)}M`
              }
              accent
              accentColor={d.jackpotGrowth >= 0 ? "green" : "red"}
            />
            <StatRow
              label="Cycle Start Jackpot"
              value={`$${d.moonPriceAtReset}M`}
            />
          </div>
        </Card>

        {/* ── Historical Cycles Summary ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel icon="🏛" text="Cycle History" as="h2" />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {(hiddenCount > 0 || showAllCycles) && (
              <button
                data-testid="button-toggle-cycles"
                onClick={() => setShowAllCycles(!showAllCycles)}
                style={{
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 6,
                  padding: "6px 0",
                  marginBottom: 6,
                  cursor: "pointer",
                  fontFamily: "'Nunito Sans'",
                  fontSize: 9,
                  color: T.textMuted,
                  letterSpacing: 0.5,
                  textAlign: "center",
                  transition: "all 0.2s",
                }}
              >
                {showAllCycles
                  ? "↑ Show recent cycles"
                  : `↓ Show ${hiddenCount} older cycle${hiddenCount > 1 ? "s" : ""}`}
              </button>
            )}
            {visibleCycles.map((cycle: any, i: number) => (
              <div
                key={cycle.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom:
                    i < visibleCycles.length - 1
                      ? "1px solid rgba(255,255,255,0.03)"
                      : "none",
                }}
              >
                {/* Color swatch */}
                <div
                  style={{
                    width: 3,
                    alignSelf: "stretch",
                    borderRadius: 2,
                    background: cycle.color,
                    flexShrink: 0,
                    minHeight: 36,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Montserrat'",
                        fontSize: 10,
                        fontWeight: 600,
                        color: cycle.color,
                        letterSpacing: 1,
                      }}
                    >
                      {cycle.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Nunito Sans'",
                        fontSize: 11,
                        color: cycle.peak ? T.textPrimary : T.gold,
                      }}
                    >
                      {cycle.peak
                        ? `$${cycle.peak.toLocaleString()}M`
                        : `$${d.estimated}M+`}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 3,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Nunito Sans'",
                        fontSize: 9,
                        color: T.textMuted,
                      }}
                    >
                      {cycle.winner
                        ? cycle.draws.length
                        : Math.max(0, cycle.draws.length - 1)}{" "}
                      {cycle.winner && cycle.draws.length === 1 ? "draw" : "draws"}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Nunito Sans'",
                        fontSize: 9,
                        color: cycle.winner ? T.textSecondary : T.gold,
                      }}
                    >
                      {cycle.winnerDate ? (
                        <a
                          href={`https://www.powerball.com/draw-result?date=${cycle.winnerDate}&gc=powerball`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "inherit", textDecoration: "underline" }}
                        >
                          Won {new Date(`${cycle.winnerDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} ↗
                        </a>
                      ) : cycle.winner ? (
                        `Winner: ${cycle.winner}`
                      ) : (
                        "🟡 In progress"
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Avg stats */}
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              background: "rgba(0,0,0,0.25)",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.03)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "'Nunito Sans'",
                  fontSize: 8,
                  color: T.textMuted,
                }}
              >
                AVG PEAK
              </div>
              <div
                style={{
                  fontFamily: "'Nunito Sans'",
                  fontSize: 11,
                  color: T.textPrimary,
                  marginTop: 3,
                }}
              >
                {(() => {
                  const completed = cycles.filter((c: any) => c.peak);
                  if (completed.length === 0) return "$0M";
                  const avg = Math.round(
                    completed.reduce((s: number, c: any) => s + c.peak, 0) /
                      completed.length,
                  );
                  return `$${avg.toLocaleString()}M`;
                })()}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "'Nunito Sans'",
                  fontSize: 8,
                  color: T.textMuted,
                }}
              >
                AVG DRAWS
              </div>
              <div
                style={{
                  fontFamily: "'Nunito Sans'",
                  fontSize: 11,
                  color: T.textPrimary,
                  marginTop: 3,
                }}
              >
                {(() => {
                  const completed = cycles.filter((c: any) => c.winner);
                  if (completed.length === 0) return "—";
                  const avg = Math.round(
                    completed.reduce(
                      (s: number, c: any) => s + c.draws.length,
                      0,
                    ) / completed.length,
                  );
                  return `${avg} draws`;
                })()}
              </div>
            </div>
          </div>
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>
            Understand the reference
          </h2>
          <p style={{ lineHeight: 1.7, fontSize: 14 }}>
            Reference growth describes changes in the calculated reference
            value, not investment returns. MOON’s market price is set
            independently. Jackpot resets, limited liquidity, and smart-contract
            bugs can cause losses. There is no guaranteed redemption.
          </p>
          <a href="/technical-paper" style={{ color: T.gold }}>
            Read the model and risks →
          </a>
        </Card>

        {/* ── Waitlist ── */}
        <div ref={waitlistRef}>
          <Card glow style={{ marginBottom: 14 }}>
            <SectionLabel icon="🚀" text="Join the Waitlist" as="h2" />
            <p
              style={{
                fontFamily: "'Rajdhani'",
                fontSize: 13,
                color: T.textSecondary,
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              Get Moonball launch updates. No wallet needed; joining does not
              purchase tokens.
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                type="email"
                placeholder="your@email.com"
                value={waitlistEmail}
                onChange={(e) => {
                  setWaitlistEmail(e.target.value);
                  setWaitlistMsg("");
                }}
                data-testid="input-waitlist-email"
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.4)",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  color: "#fff",
                  fontFamily: "'Nunito Sans'",
                  fontSize: 13,
                  outline: "none",
                  transition: "all 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = T.gold)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && waitlistEmail.trim()) {
                    waitlistMutation.mutate(waitlistEmail.trim());
                  }
                }}
              />
              <button
                data-testid="button-waitlist-join"
                disabled={waitlistMutation.isPending}
                onClick={() => {
                  if (waitlistEmail.trim()) {
                    waitlistMutation.mutate(waitlistEmail.trim());
                  }
                }}
                style={{
                  background: waitlistMutation.isPending ? "#a0a0a0" : T.gold,
                  border: "none",
                  borderRadius: 8,
                  padding: "12px 24px",
                  fontFamily: "'Montserrat'",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#000",
                  cursor: waitlistMutation.isPending ? "wait" : "pointer",
                  boxShadow: `0 0 16px ${T.glowGold}`,
                  transition: "transform 0.1s",
                  flexShrink: 0,
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = "scale(0.98)")
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                {waitlistMutation.isPending ? "..." : "JOIN"}
              </button>
            </div>
            {waitlistMsg && (
              <div
                data-testid="text-waitlist-message"
                style={{
                  marginTop: 10,
                  textAlign: "center",
                  fontFamily: "'Nunito Sans'",
                  fontSize: 12,
                  color:
                    waitlistMsgType === "success"
                      ? "#34D399"
                      : waitlistMsgType === "error"
                        ? "#F87171"
                        : T.gold,
                  lineHeight: 1.4,
                }}
              >
                {waitlistMsg}
              </div>
            )}
          </Card>
        </div>

      </main>
      <SiteFooter />
    </div>
  );
}
