import { useState, useRef, useEffect, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import { MoonLogo } from "@/components/MoonLogo";
import { BootScreen } from "@/components/BootScreen";
import { Card } from "@/components/ui/GlowCard";
import { SectionLabel, StatRow } from "@/components/ui/StatRow";
import { MultiCycleChart } from "@/components/MultiCycleChart";
import { MiniChart } from "@/components/MiniChart";
import { WinningNumbers } from "@/components/WinningNumbers";
import { Countdown } from "@/components/Countdown";
import { PhaseIndicator, type CyclePhase } from "@/components/PhaseIndicator";
import { JACKPOT_DATA, T, MOON_V2, formatUsd, formatPct, referenceModel } from "@/lib/constants";
import { useLivePowerball, useCycles } from "@/hooks/use-moonball";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SiX } from "react-icons/si";
import { usePageView, useTrackEvent, useScrollDepth } from "@/hooks/use-analytics";

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

export default function Home() {
  const [, navigate] = useLocation();
  const [booted, setBooted] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [chartMode, setChartMode] = useState("all"); // "current" | "all"
  const [activeCycleId, setActiveCycleId] = useState<number | null>(null);

  const [showAllCycles, setShowAllCycles] = useState(false);

  const [simJackpot, setSimJackpot] = useState("");
  const simCountRef = useRef(0);

  usePageView("/");
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

  const homeRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<HTMLDivElement>(null);
  const oracleRef = useRef<HTMLDivElement>(null);
  const waitlistRef = useRef<HTMLDivElement>(null);

  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistMsg, setWaitlistMsg] = useState("");
  const [waitlistMsgType, setWaitlistMsgType] = useState<"success" | "error" | "info">("info");

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
        setWaitlistMsg(body.message || "Something went wrong. Please try again.");
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

  const { data: liveData } = useLivePowerball();
  const { data: apiCycles } = useCycles();

  const moonPriceAtReset = liveData?.moonPriceAtReset ?? JACKPOT_DATA.moonPriceAtReset;

  const d = liveData
    ? {
        ...JACKPOT_DATA,
        estimated: liveData.estimated ?? JACKPOT_DATA.estimated,
        cashValue: liveData.cashValue ?? JACKPOT_DATA.cashValue,
        nextDraw: liveData.nextDraw ?? JACKPOT_DATA.nextDraw,
        nextDrawTime: liveData.nextDrawTime ?? JACKPOT_DATA.nextDrawTime,
        lastDraw: liveData.lastDraw ?? JACKPOT_DATA.lastDraw,
        winningNumbers: liveData.winningNumbers.length > 0 ? liveData.winningNumbers : JACKPOT_DATA.winningNumbers,
        powerball: liveData.powerball ?? JACKPOT_DATA.powerball,
        drawsWithoutWinner: liveData.drawsInCurrentCycle ?? JACKPOT_DATA.drawsWithoutWinner,
        jackpotGrowth: (liveData.estimated ?? JACKPOT_DATA.estimated) - moonPriceAtReset,
        winner: liveData.winner ?? JACKPOT_DATA.winner,
        moonPriceAtReset,
      }
    : JACKPOT_DATA;

  const o = liveData?.oracle;

  const cycles = useMemo(() => {
    if (apiCycles && apiCycles.length > 0) {
      return apiCycles.map((c) => ({
        id: c.id,
        label: c.label,
        winner: c.winner,
        peak: c.peak,
        color: c.color,
        draws: (c.draws as { date: string; jackpot: number }[]) || [],
      }));
    }
    return [];
  }, [apiCycles]);

  const activeCycleData = useMemo(() => {
    return cycles.find((c) => !c.winner) || cycles[cycles.length - 1];
  }, [cycles]);

  const currentCycleDraws = useMemo(() => {
    return activeCycleData?.draws || [];
  }, [activeCycleData]);

  useEffect(() => {
    if (cycles.length > 0 && activeCycleId === null) {
      setActiveCycleId(cycles[cycles.length - 1].id);
    }
  }, [cycles, activeCycleId]);

  const MAX_VISIBLE_CYCLES = 4;
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
    if (hoursToNext !== null && hoursToNext >= 0 && hoursToNext <= DRAWING_WINDOW_HOURS) return "DRAWING";
    if (currentCycleDraws.length <= 1 || d.estimated <= 20) return "RESET";
    return "GROWTH";
  }, [d.winner, d.estimated, currentCycleDraws.length, hoursToNext]);

  const phaseLabel = useMemo(() => {
    switch (currentPhase) {
      case "RESET": return "Reset";
      case "GROWTH": return "Growth";
      case "DRAWING": return "Drawing";
      case "WINNER": return "Winner";
    }
  }, [currentPhase]);

  const navItems = [
    { icon: "🏠", label: "Home", tab: "home", ref: homeRef },
    { icon: "📊", label: "Oracle", tab: "oracle", ref: oracleRef },
    { icon: "🪙", label: "Token", tab: "token", ref: tokenRef },
    { icon: "🚀", label: "Waitlist", tab: "waitlist", ref: waitlistRef },
    { icon: "⛓️", label: "Protocol", tab: "protocol", ref: null, href: "/protocol" },
    { icon: "📄", label: "Paper", tab: "paper", ref: null, href: "/technical-paper" },
  ];

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current;
    if (!el) return;
    const headerHeight = (document.querySelector("header") as HTMLElement)?.offsetHeight ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const handleNav = (item: any) => {
    trackEvent("nav_click", { tab: item.tab, label: item.label });
    if (item.href) {
      window.scrollTo(0, 0);
      navigate(item.href);
      return;
    }
    setActiveTab(item.tab);
    setTimeout(() => {
      if (item.ref) scrollToRef(item.ref);
    }, 50);
  };

  if (!booted) return <BootScreen onComplete={() => setBooted(true)} />;

  return (
    <div
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        background: T.bg,
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        position: "relative",
        color: T.textPrimary,
        paddingBottom: 80,
      }}
    >
      {/* Scan line */}
      <div
        className="animate-scan-line"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${T.gold}15, transparent)`,
          zIndex: 100,
          pointerEvents: "none",
        }}
      />

      {/* ─── HEADER (no hamburger) ─── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(11,14,23,0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${T.border}`,
          padding: "10px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MoonLogo size={36} animate />
          <span
            style={{
              fontFamily: "'Montserrat'",
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: 3,
              background: `linear-gradient(135deg, ${T.goldLight}, ${T.gold})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            MOONBALL
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className="animate-blink"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: T.gold,
              boxShadow: `0 0 8px ${T.glowGold}`,
            }}
          />
          <span
            style={{
              fontFamily: "'Nunito Sans'",
              fontSize: 10,
              color: T.textMuted,
            }}
          >
            LIVE
          </span>
          <a
            href="https://x.com/moonballlabs?s=21"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-x-profile"
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: 4,
              color: T.textSecondary,
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.textSecondary)}
          >
            <SiX size={14} />
          </a>
        </div>
      </header>

      {/* ─── CONTENT ─── */}
      <main style={{ padding: "0 16px" }} className="animate-fade-up">
        {/* Hero Banner */}
        <div
          ref={homeRef}
          style={{ textAlign: "center", padding: "28px 0 20px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <MoonLogo size={64} animate />
          </div>
          <h1
            style={{
              fontFamily: "'Nunito Sans'",
              fontSize: 9,
              color: T.textMuted,
              letterSpacing: 4,
              marginBottom: 12,
              fontWeight: 400,
              margin: "0 0 12px",
            }}
          >
            TRADE THE JACKPOT
          </h1>
          <div
            style={{
              fontFamily: "'Bebas Neue'",
              fontSize: 48,
              fontWeight: 400,
              background: `linear-gradient(135deg, ${T.goldLight} 0%, ${T.gold} 50%, ${T.goldDark} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1,
              marginBottom: 8,
              letterSpacing: 2,
            }}
          >
            ${d.estimated}M
          </div>
          <div
            style={{
              fontFamily: "'Rajdhani'",
              fontSize: 13,
              color: T.textSecondary,
              fontWeight: 500,
              letterSpacing: 1,
            }}
          >
            Powerball Estimated Jackpot
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: `${T.gold}0A`,
              borderRadius: 20,
              padding: "6px 14px",
              marginTop: 12,
              border: `1px solid ${T.gold}1A`,
            }}
          >
            <span
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 11,
                color: T.gold,
              }}
            >
              ANNUITIZED
            </span>
            <span style={{ color: T.textMuted, margin: "0 4px" }}>|</span>
            <span
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 11,
                color: T.textSecondary,
              }}
            >
              Cash: ${d.cashValue}M
            </span>
          </div>
        </div>

        {/* ── Oracle Reference Value ── */}
        <div ref={tokenRef}>
          <Card glow style={{ marginBottom: 14, padding: "10px 14px" }}>
            <SectionLabel icon="🪙" text="MOON Market" as="h2" />
            {/* Market Price + Oracle Value side by side (market first) */}
            <div style={{ display: "flex", alignItems: "stretch", gap: 8, margin: "-2px 0 8px" }}>
              <div style={{ flex: 1, background: `${T.blue}0D`, borderRadius: 10, padding: "10px 12px", border: `1px solid ${T.blue}26` }}>
                <div style={{ fontFamily: "'Nunito Sans'", fontSize: 8, color: T.textMuted, letterSpacing: 1.5, marginBottom: 4 }}>
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
                <div style={{ fontFamily: "'Nunito Sans'", fontSize: 8, color: T.textMuted, lineHeight: 1.3, marginTop: 4 }}>
                  Set by the DEX market
                </div>
              </div>
              <div style={{ flex: 1, background: `${T.gold}0D`, borderRadius: 10, padding: "10px 12px", border: `1px solid ${T.gold}26` }}>
                <div style={{ fontFamily: "'Nunito Sans'", fontSize: 8, color: T.textMuted, letterSpacing: 1.5, marginBottom: 4 }}>
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
                <div style={{ fontFamily: "'Nunito Sans'", fontSize: 8, color: T.textMuted, lineHeight: 1.3, marginTop: 4 }}>
                  Reference, not a price
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: "'Nunito Sans'", fontSize: 8, color: T.textMuted, letterSpacing: 0.5 }}>
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
                { label: "Cycle Return", value: o ? `+${Math.round(((o.oracleValue - MOON_V2.baseValue) / MOON_V2.baseValue) * 100)}%` : "—" },
                { label: "Reset Risk", value: o ? formatPct(o.resetRisk) : "—" },
                { label: "Confidence", value: o?.confidence ?? "—" },
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
              <div style={{ fontFamily: "'Nunito Sans'", fontSize: 9, color: T.textSecondary, letterSpacing: 2 }}>
                JACKPOT
              </div>
              <div
                data-testid="text-jackpot"
                style={{ fontFamily: "'Bebas Neue'", fontSize: 24, fontWeight: 400, color: "#fff", marginTop: 4, letterSpacing: 1 }}
              >
                ${d.estimated}M
              </div>
            </div>
            <div
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: `${T.blue}18`, border: `1px solid ${T.blue}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, color: T.blue,
              }}
            >
              →
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontFamily: "'Nunito Sans'", fontSize: 9, color: T.textSecondary, letterSpacing: 2 }}>
                ORACLE VALUE
              </div>
              <div
                data-testid="text-oracle-value"
                style={{ fontFamily: "'Bebas Neue'", fontSize: 24, fontWeight: 400, color: T.gold, marginTop: 4, letterSpacing: 1 }}
              >
                {o ? formatUsd(o.oracleValue) : "—"}
              </div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontFamily: "'Nunito Sans'", fontSize: 9, color: T.textSecondary, letterSpacing: 2 }}>
                RESET RISK
              </div>
              <div
                data-testid="text-reset-risk"
                style={{
                  fontFamily: "'Bebas Neue'", fontSize: 24, fontWeight: 400, marginTop: 4, letterSpacing: 1,
                  color: o && o.resetRisk >= 0.5 ? "#F87171" : o && o.resetRisk >= 0.25 ? T.gold : "#34D399",
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
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: T.textMuted }}>$</span>
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
                  <div style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    borderRadius: 10,
                    background: "rgba(245,166,35,0.06)",
                    border: "1px solid rgba(245,166,35,0.15)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontFamily: "'Nunito Sans'", fontSize: 9, letterSpacing: 2, color: T.textSecondary, marginBottom: 4 }}>
                          ORACLE VALUE
                        </div>
                        <div data-testid="text-sim-oracle-value" style={{
                          fontFamily: "'Bebas Neue'", fontSize: 28, color: T.gold, letterSpacing: 1, lineHeight: 1,
                        }}>
                          {formatUsd(ref.oracleValue)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'Nunito Sans'", fontSize: 9, letterSpacing: 2, color: T.textSecondary, marginBottom: 4 }}>
                          RESET RISK
                        </div>
                        <div data-testid="text-sim-reset-risk" style={{
                          fontFamily: "'Bebas Neue'", fontSize: 28, letterSpacing: 1, lineHeight: 1,
                          color: ref.resetRisk >= 0.5 ? "#F87171" : ref.resetRisk >= 0.25 ? T.gold : "#34D399",
                        }}>
                          {formatPct(ref.resetRisk)}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      paddingTop: 10,
                      display: "flex",
                      justifyContent: "flex-end",
                    }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'Nunito Sans'", fontSize: 9, letterSpacing: 2, color: T.textSecondary, marginBottom: 4 }}>
                          RISK-ADJUSTED VALUE
                        </div>
                        <div data-testid="text-sim-risk-adjusted" style={{
                          fontFamily: "'Bebas Neue'", fontSize: 28, color: "#fff", letterSpacing: 1, lineHeight: 1,
                        }}>
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
          <SectionLabel icon="📈" text="Price History" as="h2" />

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
            {["This Cycle", "All Cycles"].map((t, i) => {
              const mode = i === 0 ? "current" : "all";
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
              cycles={visibleCycles}
              activeCycleId={activeCycleId ?? visibleCycles[visibleCycles.length - 1]?.id ?? 1}
              onSelectCycle={setActiveCycleId}
            />
          )}
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
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid rgba(255,255,255,0.05)`,
            marginBottom: 16,
          }}>
            <div>
              <div style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 9,
                letterSpacing: 2,
                color: T.textSecondary,
                marginBottom: 2,
              }}>
                DRAW DATE
              </div>
              <div style={{
                fontFamily: "'Montserrat'",
                fontSize: 14,
                fontWeight: 700,
                color: T.textPrimary,
              }}>
                {d.lastDraw}
              </div>
            </div>
            <div style={{
              fontFamily: "'Bebas Neue'",
              fontSize: 14,
              letterSpacing: 1,
              padding: "4px 12px",
              borderRadius: 4,
              background: d.winner === "No" ? "rgba(239,68,68,0.12)" : "rgba(52,211,153,0.12)",
              border: `1px solid ${d.winner === "No" ? "rgba(239,68,68,0.25)" : "rgba(52,211,153,0.25)"}`,
              color: d.winner === "No" ? "#F87171" : "#34D399",
            }}>
              {d.winner === "No" ? "NO WINNER" : "WINNER"}
            </div>
          </div>

          {/* Winning numbers label */}
          <div style={{
            fontFamily: "'Nunito Sans'",
            fontSize: 9,
            letterSpacing: 2,
            color: T.textSecondary,
            marginBottom: 10,
            textAlign: "center",
          }}>
            WINNING NUMBERS
          </div>

          {/* Enhanced winning number balls */}
          <div style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            padding: "8px 0 16px",
          }}>
            {d.winningNumbers.map((n: number, i: number) => (
              <div
                key={i}
                data-testid={`ball-number-${i}`}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.1) 0%, rgba(59,130,246,0.08) 60%, rgba(59,130,246,0.02) 100%)",
                  border: `1.5px solid rgba(59,130,246,0.3)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Bebas Neue'",
                  fontSize: 18,
                  color: "#e0e8f0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
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
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            paddingBottom: 6,
          }}>
            <div style={{
              fontFamily: "'Nunito Sans'",
              fontSize: 8,
              letterSpacing: 1.5,
              color: T.textMuted,
              width: 40 * d.winningNumbers.length + 10 * (d.winningNumbers.length - 1),
              textAlign: "center",
            }}>
              WHITE BALLS
            </div>
            <div style={{
              fontFamily: "'Nunito Sans'",
              fontSize: 8,
              letterSpacing: 1.5,
              color: T.goldDark,
              width: 40,
              textAlign: "center",
            }}>
              PB
            </div>
          </div>
        </Card>

        {/* ── Oracle Reference ── */}
        <div ref={oracleRef}>
          <Card style={{ marginBottom: 14 }} glowColor="blue">
            <SectionLabel icon="⛓" text="Oracle Reference" as="h2" />
            <StatRow label="Headline Value" value={o ? formatUsd(o.oracleValue) : "—"} accent accentColor="blue" />
            <StatRow label="Risk-adjusted Value" value={o ? formatUsd(o.riskAdjustedValue) : "—"} />
            <StatRow
              label="Reset Risk (next draw)"
              value={o ? formatPct(o.resetRisk) : "—"}
              accent
              accentColor={o && o.resetRisk >= 0.5 ? "red" : "gold"}
            />
            <StatRow
              label="Confidence"
              value={o?.confidence ?? "—"}
              accent
              accentColor={o?.confidence === "High" ? "green" : o?.confidence === "Medium" ? "gold" : "red"}
            />
            <StatRow
              label="Source Consensus"
              value={o ? `${o.consensusCount} / ${o.totalSources} agree` : "—"}
            />
            {o && (
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {o.dataSources.map((src) => (
                  <span
                    key={src.name}
                    data-testid={`source-${src.name}`}
                    style={{
                      fontFamily: "'Nunito Sans'",
                      fontSize: 9,
                      letterSpacing: 0.3,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: src.contributing ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${src.contributing ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.08)"}`,
                      color: src.contributing ? "#34D399" : T.textMuted,
                    }}
                  >
                    {src.contributing ? "● " : "○ "}{src.name}
                  </span>
                ))}
              </div>
            )}
            <p style={{ fontFamily: "'Nunito Sans'", fontSize: 10, color: T.textMuted, lineHeight: 1.6, marginTop: 12 }}>
              The oracle publishes a reference value only — it does not set or defend the market price. A value is
              confirmed once at least two independent sources agree on the jackpot.
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
              value={d.jackpotGrowth >= 0 ? `+$${d.jackpotGrowth}M` : `-$${Math.abs(d.jackpotGrowth)}M`}
              accent
              accentColor={d.jackpotGrowth >= 0 ? "green" : "red"}
            />
            <StatRow label="Cycle Start Jackpot" value={`$${d.moonPriceAtReset}M`} />
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
                  ? `▲ HIDE ${cycles.length - MAX_VISIBLE_CYCLES} OLDER CYCLE${cycles.length - MAX_VISIBLE_CYCLES > 1 ? "S" : ""}`
                  : `▼ SHOW ${hiddenCount} OLDER CYCLE${hiddenCount > 1 ? "S" : ""}`}
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
                      {cycle.winner ? cycle.draws.length : Math.max(0, cycle.draws.length - 1)} draws
                    </span>
                    <span
                      style={{
                        fontFamily: "'Nunito Sans'",
                        fontSize: 9,
                        color: cycle.winner ? T.textSecondary : T.gold,
                      }}
                    >
                      {cycle.winner
                        ? `Winner: ${cycle.winner}`
                        : "🟡 In progress"}
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
                  const avg = Math.round(completed.reduce((s: number, c: any) => s + c.peak, 0) / completed.length);
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
                  const avg = Math.round(completed.reduce((s: number, c: any) => s + c.draws.length, 0) / completed.length);
                  return `${avg} draws`;
                })()}
              </div>
            </div>
          </div>
        </Card>

        {/* ── How It Works ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel icon="💡" text="How It Works" as="h2" />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              {
                num: "01",
                title: "Jackpot Rises",
                desc: "Powerball jackpot grows with each drawing without a winner.",
              },
              {
                num: "02",
                title: "Oracle Publishes a Reference",
                desc: "A multi-source oracle posts a transparent reference value derived from the jackpot — context, not a peg.",
              },
              {
                num: "03",
                title: "Traders Set the Price",
                desc: "MOON trades freely on a DEX. The market price can sit above or below the oracle reference.",
              },
              {
                num: "04",
                title: "Reset Cycle",
                desc: "When a winner is drawn, the jackpot resets and the oracle reference drops back to its base.",
              },
            ].map((step, i) => (
              <div
                key={step.num}
                data-testid={`step-${step.num}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 0",
                  borderBottom:
                    i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Montserrat'",
                    fontSize: 14,
                    fontWeight: 700,
                    color: T.gold,
                    flexShrink: 0,
                    minWidth: 28,
                  }}
                >
                  {step.num}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: "'Rajdhani'",
                      fontSize: 15,
                      fontWeight: 700,
                      color: T.textPrimary,
                      marginBottom: 3,
                    }}
                  >
                    {step.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Nunito Sans'",
                      fontSize: 11,
                      color: T.textSecondary,
                      lineHeight: 1.5,
                    }}
                  >
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Tokenomics ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel icon="📊" text="Tokenomics" as="h2" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              {
                icon: "🔗",
                title: "Jackpot-linked Oracle",
                desc: "A transparent reference value tracks the jackpot in real time.",
                accent: T.gold,
              },
              {
                icon: "⚙️",
                title: "Free-floating Price",
                desc: "The market sets MOON's price; the oracle is a reference, not a peg.",
                accent: T.blue,
              },
              {
                icon: "💎",
                title: "Trade on a DEX",
                desc: "Swap MOON anytime in an open liquidity pool — no protocol redemption.",
                accent: T.blue,
              },
              {
                icon: "⚡",
                title: "Reset Risk Pricing",
                desc: "Risk-adjusted value reflects the odds the jackpot resets at the next draw.",
                accent: T.gold,
              },
              {
                icon: "🏦",
                title: "Visible Treasury",
                desc: "An on-chain treasury funds liquidity and operations — it never defends a price.",
                accent: T.gold,
              },
              {
                icon: "🌐",
                title: "Future Expansion",
                desc: "Starting with Powerball, then Mega Millions.",
                accent: T.blue,
              },
            ].map((item, i) => (
              <div
                key={item.title}
                data-testid={`tokenomics-item-${i}`}
                style={{
                  padding: "14px 12px",
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${item.accent}08, ${item.accent}03)`,
                  border: `1px solid ${item.accent}18`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: `${item.accent}08`,
                  filter: "blur(8px)",
                }} />
                <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                <div
                  style={{
                    fontFamily: "'Rajdhani'",
                    fontSize: 14,
                    fontWeight: 700,
                    color: item.accent,
                    marginBottom: 4,
                    letterSpacing: "0.02em",
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    fontFamily: "'Nunito Sans'",
                    fontSize: 10.5,
                    color: T.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── How MOON Trades (DEX flow) ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel icon="🔁" text="How MOON Trades" as="h2" />
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 4,
            }}
          >
            {[
              { icon: "🎰", title: "Jackpot", desc: "Public Powerball data" },
              { icon: "🛰", title: "Oracle", desc: "Reference value on-chain" },
              { icon: "💧", title: "DEX Pool", desc: `${MOON_V2.poolPair}` },
              { icon: "🧑‍💻", title: "Traders", desc: "Set the market price" },
            ].map((node, i, arr) => (
              <div key={node.title} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div
                  data-testid={`flow-node-${i}`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "12px 6px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{node.icon}</div>
                  <div style={{ fontFamily: "'Rajdhani'", fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>
                    {node.title}
                  </div>
                  <div style={{ fontFamily: "'Nunito Sans'", fontSize: 9, color: T.textSecondary, marginTop: 3, lineHeight: 1.4 }}>
                    {node.desc}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ color: T.blue, fontSize: 16, padding: "0 2px" }}>→</div>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontFamily: "'Nunito Sans'", fontSize: 10, color: T.textMuted, lineHeight: 1.6, marginTop: 12 }}>
            You buy and sell MOON in an open liquidity pool. The protocol does not mint to you, redeem from you,
            or guarantee any price — it only publishes the oracle reference and helps keep the pool liquid.
          </p>
        </Card>

        {/* ── Treasury ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel icon="🏦" text="What the Treasury Does" as="h2" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {MOON_V2.treasuryJobs.map((job, i) => (
              <div
                key={job.title}
                data-testid={`treasury-job-${i}`}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: `${T.gold}06`,
                  border: `1px solid ${T.gold}14`,
                }}
              >
                <div style={{ fontFamily: "'Rajdhani'", fontSize: 14, fontWeight: 700, color: T.gold, letterSpacing: "0.02em", marginBottom: 4 }}>
                  {job.title}
                </div>
                <div style={{ fontFamily: "'Nunito Sans'", fontSize: 10.5, color: T.textSecondary, lineHeight: 1.5 }}>
                  {job.desc}
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: "'Nunito Sans'", fontSize: 10, color: T.textMuted, lineHeight: 1.6, marginTop: 12 }}>
            The treasury is visible on-chain, but it never defends the MOON price. Reserves are not a redemption
            backstop and create no claim on the protocol.
          </p>
        </Card>

        {/* ── Risk ── */}
        <Card style={{ marginBottom: 14 }} glowColor="blue">
          <SectionLabel icon="⚠️" text="Know the Risks" as="h2" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {[
              {
                title: "Reset risk",
                desc: "When a winner is drawn, the jackpot resets and the oracle reference drops sharply. The market price can fall just as fast.",
              },
              {
                title: "No redemption",
                desc: "There is no protocol buy-back or peg. The only way out of a position is to sell to another trader in the pool.",
              },
              {
                title: "Market & liquidity risk",
                desc: "Price is set by supply and demand. Thin liquidity means large trades can move the price and exits may be costly.",
              },
              {
                title: "Smart contract risk",
                desc: "Contracts can contain bugs. Audits reduce but never eliminate this risk. Only commit what you can afford to lose.",
              },
            ].map((risk, i) => (
              <div
                key={risk.title}
                data-testid={`risk-item-${i}`}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.05)",
                  border: "1px solid rgba(239,68,68,0.15)",
                }}
              >
                <div style={{ fontFamily: "'Rajdhani'", fontSize: 14, fontWeight: 700, color: "#F87171", letterSpacing: "0.02em", marginBottom: 4 }}>
                  {risk.title}
                </div>
                <div style={{ fontFamily: "'Nunito Sans'", fontSize: 10.5, color: T.textSecondary, lineHeight: 1.5 }}>
                  {risk.desc}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── FAQ ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel icon="❓" text="Frequently Asked Questions" as="h2" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            {[
              {
                q: "Is MOON pegged to the jackpot?",
                a: "No. The oracle publishes a reference value derived from public jackpot data, but the price floats freely on the DEX. The market can trade above or below the reference.",
              },
              {
                q: "Is MOON backed by anything?",
                a: "MOON is not a redeemable claim on reserves. Its value comes from what traders will pay in the open market. The oracle reference is derived from public jackpot data — it is information, not a backing or buy-back promise.",
              },
              {
                q: "Why can the market price be below the oracle value?",
                a: "The oracle value is just a reference. As a draw nears, traders price in the chance the jackpot resets, so MOON often trades at a discount to the headline oracle value. Supply, demand, and liquidity depth can push it above or below at any time.",
              },
              {
                q: "Can I redeem MOON with the protocol?",
                a: "No. There is no mint or redeem. You buy and sell MOON with other traders in the liquidity pool.",
              },
              {
                q: "What happens if a whale sells a large position?",
                a: "Exits are DEX swaps, so a large sell moves the price down the pool's curve and pays slippage proportional to its size. No one can drain a treasury or jump a redemption queue — the pool simply reprices. That is the core safety benefit of having no redemption.",
              },
              {
                q: "What is the risk-adjusted value?",
                a: "It discounts the oracle value by the survival probability — the chance the jackpot is not won at the next draw — giving a more conservative reference than the headline number.",
              },
              {
                q: "Does the treasury protect the price?",
                a: "No. The treasury funds liquidity, the oracle, and operations. It never buys back or defends a price level.",
              },
              {
                q: "What happens when someone wins the jackpot?",
                a: "The jackpot resets to its base, the oracle reference drops accordingly, and a new cycle begins. The market reprices on its own.",
              },
            ].map((item, i) => (
              <div key={i} data-testid={`faq-item-${i}`}>
                <div style={{ fontFamily: "'Rajdhani'", fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "0.01em", marginBottom: 4 }}>
                  {item.q}
                </div>
                <div style={{ fontFamily: "'Nunito Sans'", fontSize: 11, color: T.textSecondary, lineHeight: 1.6 }}>
                  {item.a}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Roadmap ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel icon="🗺" text="Roadmap" as="h2" />
          <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative", paddingLeft: 28 }}>
            {/* Vertical timeline line */}
            <div style={{
              position: "absolute",
              left: 9,
              top: 18,
              bottom: 18,
              width: 2,
              background: `linear-gradient(180deg, ${T.gold} 0%, ${T.gold} 25%, rgba(245,166,35,0.15) 25%, rgba(245,166,35,0.15) 100%)`,
            }} />
            {[
              { phase: "Q2 2026", title: "Smart Contract & Audit", desc: "Solidity contracts finalized, third-party audit complete, testnet deployment", status: "active" as const },
              { phase: "Q3 2026", title: "Powerball Launch", desc: "Mainnet launch, oracle reference live, DEX liquidity pool seeded", status: "upcoming" as const },
              { phase: "Late 2026", title: "Multi-Jackpot Expansion", desc: "Mega Millions support, cross-chain bridging, institutional partnerships", status: "upcoming" as const },
              { phase: "2027", title: "Staking & Global Scaling", desc: "Yield protocol, DAO governance, international lottery expansion", status: "upcoming" as const },
            ].map((item, i) => {
              const isActive = item.status === "active";
              return (
                <div
                  key={item.phase}
                  data-testid={`roadmap-item-${i}`}
                  style={{
                    position: "relative",
                    padding: "16px 0 16px 16px",
                    borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.03)" : "none",
                  }}
                >
                  {/* Timeline node */}
                  <div style={{
                    position: "absolute",
                    left: -24,
                    top: 20,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: isActive ? T.gold : "rgba(14,18,30,0.95)",
                    border: `2px solid ${isActive ? T.gold : "rgba(245,166,35,0.2)"}`,
                    boxShadow: isActive ? `0 0 10px ${T.glowGold}, 0 0 20px rgba(245,166,35,0.15)` : "none",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {isActive && (
                      <div style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "#000",
                      }} />
                    )}
                  </div>

                  {/* Phase badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span
                      style={{
                        fontFamily: "'Montserrat'",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1.2,
                        textTransform: "uppercase",
                        color: isActive ? "#000" : T.textSecondary,
                        background: isActive ? T.gold : "rgba(245,166,35,0.08)",
                        padding: "3px 10px",
                        borderRadius: 4,
                        border: isActive ? "none" : `1px solid rgba(245,166,35,0.12)`,
                        boxShadow: isActive ? `0 0 12px ${T.glowGold}` : "none",
                      }}
                    >
                      {item.phase}
                    </span>
                    {isActive && (
                      <span style={{
                        fontFamily: "'Nunito Sans'",
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        color: T.gold,
                        animation: "countdown-pulse 2s ease-in-out infinite",
                      }}>
                        IN PROGRESS
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <div style={{
                    fontFamily: "'Montserrat'",
                    fontSize: 14,
                    fontWeight: 700,
                    color: isActive ? T.textPrimary : "rgba(240,230,211,0.5)",
                    marginBottom: 4,
                    letterSpacing: 0.3,
                  }}>
                    {item.title}
                  </div>

                  {/* Description */}
                  <div style={{
                    fontFamily: "'Rajdhani'",
                    fontSize: 12,
                    fontWeight: 500,
                    color: isActive ? T.textSecondary : T.textMuted,
                    lineHeight: 1.5,
                  }}>
                    {item.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── About Us ── */}
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel icon="👤" text="About Us" as="h2" />
          <div style={{ padding: "6px 0" }}>
            <div
              style={{
                fontFamily: "'Montserrat'",
                fontSize: 16,
                fontWeight: 700,
                color: T.textPrimary,
                marginBottom: 2,
              }}
            >
              Edgar Ramirez
            </div>
            <div
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 11,
                fontWeight: 600,
                color: T.gold,
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              Founder & CEO
            </div>
            <div
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 11,
                color: T.textSecondary,
                lineHeight: 1.6,
                marginBottom: 10,
              }}
            >
              BBA in Finance with 6+ years in banking operations, compliance, and financial systems. Built Moonball from concept to MVP, designing its tokenomics, oracle reference model, and behavioral pricing framework.
            </div>
            <div
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 11,
                color: T.textSecondary,
                lineHeight: 1.6,
                marginBottom: 10,
              }}
            >
              Focused on disciplined growth, regulatory clarity, and long-term protocol sustainability.
            </div>
            <div
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 11,
                color: T.textSecondary,
                lineHeight: 1.6,
              }}
            >
              Founded Moonball in April 2025 to pioneer behavioral-based digital assets.
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 16, paddingTop: 16 }}>
            <div
              style={{
                fontFamily: "'Montserrat'",
                fontSize: 16,
                fontWeight: 700,
                color: T.textPrimary,
                marginBottom: 2,
              }}
            >
              Julio Valdes
            </div>
            <div
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 11,
                fontWeight: 600,
                color: T.gold,
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              Founding Frontend Engineer
            </div>
            <div
              style={{
                fontFamily: "'Nunito Sans'",
                fontSize: 11,
                color: T.textSecondary,
                lineHeight: 1.6,
              }}
            >
              Built and architected the Moonball MVP interface.
            </div>
          </div>
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
              Be first to access MOON token when we launch. Early waitlist
              members get priority allocation.
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
                onChange={(e) => { setWaitlistEmail(e.target.value); setWaitlistMsg(""); }}
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
                onFocus={(e) =>
                  (e.target.style.borderColor = T.gold)
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = T.border)
                }
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
                  color: waitlistMsgType === "success" ? "#34D399" : waitlistMsgType === "error" ? "#F87171" : T.gold,
                  lineHeight: 1.4,
                }}
              >
                {waitlistMsg}
              </div>
            )}
          </Card>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            textAlign: "center",
            paddingBottom: 80,
            paddingTop: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <MoonLogo size={30} animate />
          </div>
          <div
            style={{
              fontFamily: "'Montserrat'",
              fontSize: 10,
              color: "#FFFDD0",
              letterSpacing: 3,
              marginTop: 8,
              marginBottom: 10,
            }}
          >
            MOONBALL
          </div>
          <div
            style={{
              fontFamily: "'Nunito Sans'",
              fontSize: 9,
              color: "#FFFFFF",
              lineHeight: 1.6,
              maxWidth: 320,
              margin: "0 auto",
            }}
          >
            &copy; 2026 &ndash; Jackpot-linked event market. Not a lottery, not
            gambling, not financial advice. MOON trades freely on a DEX; the
            oracle publishes a reference value from public jackpot data and the
            protocol never redeems or defends a price.
          </div>
        </div>
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 430,
          margin: "0 auto",
          background: "rgba(11,14,23,0.9)",
          backdropFilter: "blur(20px)",
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          justifyContent: "space-around",
          padding: "12px 0 20px", // extra padding for iOS home bar
          zIndex: 50,
        }}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.tab;
          const sharedStyle = {
            background: "transparent",
            border: "none",
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center" as const,
            gap: 4,
            cursor: "pointer",
            opacity: isActive ? 1 : 0.5,
            transition: "opacity 0.2s",
            width: 60,
            textDecoration: "none",
          };
          const inner = (
            <>
              <span
                style={{
                  fontSize: 18,
                  filter: isActive
                    ? `drop-shadow(0 0 8px ${T.glowGold})`
                    : "grayscale(100%)",
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontFamily: "'Nunito Sans'",
                  fontSize: 9,
                  color: isActive ? T.gold : T.textSecondary,
                  letterSpacing: 0.5,
                }}
              >
                {item.label}
              </span>
            </>
          );
          if (item.href) {
            return (
              <a
                key={item.tab}
                href={item.href}
                onClick={(e) => { e.preventDefault(); handleNav(item); }}
                style={sharedStyle}
              >
                {inner}
              </a>
            );
          }
          return (
            <button
              key={item.tab}
              onClick={() => handleNav(item)}
              style={sharedStyle}
            >
              {inner}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
