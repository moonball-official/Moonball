import { useEffect, useState } from "react";
import { MoonLogo } from "@/components/MoonLogo";
import { Card } from "@/components/ui/GlowCard";
import { SectionLabel } from "@/components/ui/StatRow";
import { T, TOKENOMICS, formatUsd, vestingStatus } from "@/lib/constants";
import { useLocation } from "wouter";
import { usePageView, useScrollDepth } from "@/hooks/use-analytics";
import { useLivePowerball, type OracleModel } from "@/hooks/use-moonball";

export default function TechnicalPaper() {
  const [, navigate] = useLocation();
  usePageView("/technical-paper");
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useScrollDepth();
  const { data: live } = useLivePowerball();
  const oracle = live?.oracle;

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
        paddingBottom: 40,
      }}
    >
      {/* Header */}
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
        <a
          href="/"
          data-testid="button-back-home"
          onClick={(e) => { e.preventDefault(); navigate("/"); }}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: "6px 14px",
            fontFamily: "'Nunito Sans'",
            fontSize: 11,
            color: T.textSecondary,
            cursor: "pointer",
            transition: "all 0.2s",
            textDecoration: "none",
            display: "inline-block",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSecondary; }}
        >
          Back
        </a>
      </header>

      <main style={{ padding: "0 16px", marginTop: 16 }}>
        <h1 className="sr-only">Moonball Technical Paper</h1>
        <Card style={{ marginBottom: 14, overflow: "visible" }}>
          <SectionLabel icon="📄" text="Technical Paper" />

          {/* 1 — Protocol Overview */}
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontFamily: "'Montserrat'", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
              1. Protocol Overview
            </h2>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>
              MOON is an ERC-20 token that trades freely on a decentralized exchange. The protocol does <span style={{ color: "#fff", fontWeight: 700 }}>not</span> peg, mint-on-demand, or redeem the token. Instead, an on-chain oracle publishes a transparent <span style={{ color: "#fff", fontWeight: 700 }}>reference value</span> derived from public jackpot data, and the market decides where MOON actually trades relative to that reference. This makes MOON an event market on the Powerball cycle rather than a collateralized stable instrument.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              {[
                { label: "PRICE", value: "Free-float" },
                { label: "STANDARD", value: "ERC-20" },
                { label: "MARKET", value: "DEX pool" },
                { label: "ORACLE", value: "Multi-source" },
              ].map((item) => (
                <div key={item.label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "8px 10px", border: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: "'Nunito Sans'", fontSize: 9, color: T.textMuted, letterSpacing: 1 }}>{item.label}</div>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 16, color: "#fff" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 2 — Oracle Reference Model */}
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontFamily: "'Montserrat'", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
              2. Oracle Reference Model
            </h2>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 12, color: T.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
              The oracle publishes three numbers each cycle. None of them is a price the protocol will honor &mdash; they are context for traders.
            </p>
            <div style={{ fontFamily: "'Rajdhani'", fontSize: 12, color: T.textSecondary, lineHeight: 1.7, marginBottom: 10 }}>
              <div><span style={{ color: "#fff", fontWeight: 600 }}>Oracle value</span> = $10 &times; (jackpot$M / $20M)</div>
              <div><span style={{ color: "#fff", fontWeight: 600 }}>Reset risk</span> = 1 &minus; e<sup>&minus;(jackpot$M &times; 0.4) / 292.2</sup></div>
              <div><span style={{ color: "#fff", fontWeight: 600 }}>Risk-adjusted</span> = oracle &times; (1 &minus; p)</div>
            </div>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
              The raw oracle value scales linearly with the jackpot from a $10 base at a fresh $20M reset. Reset risk <span style={{ color: "#fff" }}>p</span> is the modelled probability that the next draw produces a winner, growing with ticket sales as the jackpot climbs. The risk-adjusted value discounts the raw value by the survival probability <span style={{ color: "#fff" }}>(1&nbsp;&minus;&nbsp;p)</span> &mdash; a more conservative reference as a draw approaches.
            </p>
          </div>

          {/* 3 — Consensus & Confidence */}
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontFamily: "'Montserrat'", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
              3. Consensus & Confidence
            </h2>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 12, color: T.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
              The jackpot figure is sourced from multiple independent providers in parallel. A value is only published once at least two sources agree within tolerance, and a confidence grade reflects how many concur.
            </p>
            <div style={{ overflow: "hidden", borderRadius: 8, border: `1px solid ${T.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Nunito Sans'", fontSize: 10 }}>
                <thead>
                  <tr style={{ background: "rgba(245,166,35,0.1)" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", color: T.gold, fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>SOURCES AGREEING</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", color: T.gold, fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>CONFIDENCE</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", color: T.gold, fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>PUBLISHED?</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { n: "\u2265 3", conf: "High", sc: "#34D399", pub: "Yes" },
                    { n: "2", conf: "Medium", sc: "#FBBF24", pub: "Yes" },
                    { n: "< 2", conf: "Low", sc: "#EF4444", pub: "Held" },
                  ].map((r, i) => (
                    <tr key={i} style={{ borderBottom: i < 2 ? `1px solid ${T.border}` : "none" }}>
                      <td style={{ padding: "6px 8px", color: "#fff", fontFamily: "'Bebas Neue'", fontSize: 13 }}>{r.n}</td>
                      <td style={{ padding: "6px 8px" }}>
                        <span style={{ background: `${r.sc}20`, color: r.sc, padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>{r.conf}</span>
                      </td>
                      <td style={{ padding: "6px 8px", color: T.textSecondary }}>{r.pub}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}`, marginTop: 8, fontFamily: "'Nunito Sans'", fontSize: 10, color: T.textMuted, lineHeight: 1.8, whiteSpace: "pre-line" }}>
{`Off-chain: powerball.com / usamega.com / calottery.com / texaslottery.com
           \u2192 consensus engine (2+ agree)
On-chain:  Oracle (value / reset-risk / confidence)
Market:    MOON / USDC DEX pool \u2190 traders set price`}
            </div>
          </div>

          {/* 4 — No Redemption, No Liability */}
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontFamily: "'Montserrat'", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
              4. No Redemption, No Liability
            </h2>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>
              There is no mint or redeem function exposed to users and no promise to buy MOON back at any price. The protocol holds no liability against the circulating supply, so it cannot become undercollateralized and there is no health ratio or redemption haircut to manage. The only way in or out of a position is to trade with other participants in the liquidity pool.
            </p>
          </div>

          {/* 5 — Liquidity & LP Economics */}
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontFamily: "'Montserrat'", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
              5. Liquidity & LP Economics
            </h2>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 12, color: T.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
              MOON trades against USDC in a constant-product DEX pool. Liquidity providers earn swap fees and bear standard impermanent-loss exposure. Because the jackpot cycle is mean-reverting &mdash; the reference climbs through a cycle then snaps back at a reset &mdash; LPs face elevated impermanent loss around reset events. The pool launches at a <span style={{ color: "#fff" }}>{TOKENOMICS.poolFeePct}% fee tier</span> to compensate LPs for this risk.
            </p>
            <div style={{ overflow: "hidden", borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Nunito Sans'", fontSize: 10 }}>
                <thead>
                  <tr style={{ background: "rgba(245,166,35,0.08)" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", color: T.gold, fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>POOL TVL</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", color: T.gold, fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>FEE TIER</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", color: T.gold, fontWeight: 700, borderBottom: `1px solid ${T.border}` }}>TRIGGER</th>
                  </tr>
                </thead>
                <tbody>
                  {TOKENOMICS.tvlGlidePath.map((tier, i) => (
                    <tr key={i} style={{ borderBottom: i < TOKENOMICS.tvlGlidePath.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <td style={{ padding: "6px 8px", color: "#fff", fontFamily: "'Bebas Neue'", fontSize: 13 }}>
                        {tier.tvlUsd === 0 ? "Launch" : `$${(tier.tvlUsd / 1000).toFixed(0)}K+`}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <span style={{ background: `${T.gold}20`, color: T.gold, padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>{tier.feePct}%</span>
                      </td>
                      <td style={{ padding: "6px 8px", color: T.textSecondary }}>{tier.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 11, color: T.textMuted, lineHeight: 1.5, marginBottom: 8 }}>
              <span style={{ color: "#fff" }}>Protocol skim:</span> {TOKENOMICS.protocolSkimPct}% of each swap fee is routed to the treasury at the router layer &mdash; separate from and in addition to the LP&apos;s share. LPs receive the remaining {TOKENOMICS.lpSharePct}% of every swap fee. The skim is not deducted from LP earnings; it is charged on top at the routing layer.
            </p>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
              Protocol-owned liquidity (see &sect;6) deepens the pool to tighten spreads but is never withdrawn to defend a price.
            </p>
          </div>

          {/* 6 — Treasury Policy */}
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontFamily: "'Montserrat'", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
              6. Treasury Policy
            </h2>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 12, color: T.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
              The treasury is fully visible on-chain. Its mandate is growth and operations &mdash; never price defense. Its revenue comes from the {TOKENOMICS.protocolSkimPct}% router skim on swap fees (see &sect;5).
            </p>

            {/* Liquidity Growth Policy */}
            <div style={{ background: `${T.gold}08`, border: `1px solid ${T.gold}33`, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ fontFamily: "'Nunito Sans'", fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>LIQUIDITY GROWTH POLICY</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { pct: `${TOKENOMICS.treasuryPolSplit}%`, label: "POL Reinvestment", desc: "Protocol-owned liquidity. Deepens the pool — never withdrawn to defend price.", color: T.gold },
                  { pct: `${TOKENOMICS.treasuryOpsSplit}%`, label: "Operations", desc: "Oracle, audits, infra, and development.", color: T.blue },
                ].map((s) => (
                  <div key={s.label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "8px 10px", border: `1px solid ${T.border}` }}>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: s.color, lineHeight: 1 }}>{s.pct}</div>
                    <div style={{ fontFamily: "'Nunito Sans'", fontSize: 9, color: "#fff", fontWeight: 700, marginTop: 2 }}>{s.label}</div>
                    <div style={{ fontFamily: "'Rajdhani'", fontSize: 10, color: T.textMuted, lineHeight: 1.4, marginTop: 3 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Seed & deepen liquidity", desc: "Protocol-owned liquidity for tighter spreads. Funded by the 50% POL split — grows automatically with trading volume." },
                { label: "Fund the oracle", desc: "Pays for multi-source jackpot verification published on-chain. Funded by the 50% operations split." },
                { label: "Cover operations", desc: "Audits, infrastructure, and development. Funded by the protocol skim, not by selling tokens." },
              ].map((j) => (
                <div key={j.label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 12px", border: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: "'Nunito Sans'", fontSize: 11, color: T.gold, fontWeight: 700 }}>{j.label}</div>
                  <div style={{ fontFamily: "'Rajdhani'", fontSize: 11, color: T.textSecondary, lineHeight: 1.5, marginTop: 4 }}>{j.desc}</div>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 11, color: T.textMuted, lineHeight: 1.5, marginTop: 8 }}>
              Treasury reserves create no claim on the protocol and are not a redemption backstop.
            </p>
          </div>

          {/* 7 — Reset Mechanics & Whale Exit */}
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontFamily: "'Montserrat'", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
              7. Reset Mechanics & Whale Exit
            </h2>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 12, color: T.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
              A reset is detected when the oracle reports a jackpot that drops sharply (below 50% of the last known value), indicating a winner. The reference value falls back to its base and a new cycle begins. The market reprices on its own &mdash; there is no cooldown gating trades, because there is nothing for the protocol to pause.
            </p>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
              <span style={{ color: "#fff" }}>Whale exit:</span> because exits are AMM swaps, a large holder selling moves the price down the curve and pays slippage proportional to their size relative to pool depth. No single participant can drain a treasury or jump a redemption queue; the pool simply reprices. This is the core safety property of removing redemption.
            </p>
          </div>

          {/* 8 — Attack Surface & Security */}
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontFamily: "'Montserrat'", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
              8. Attack Surface & Security
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                "Oracle manipulation \u2014 mitigated by multi-source consensus and sanity bounds; a single bad source cannot publish.",
                "Reference vs. market confusion \u2014 the UI never presents the oracle as a tradable price.",
                "AMM / liquidity risk \u2014 thin pools allow price impact; protocol-owned liquidity reduces but cannot eliminate it.",
                "Standard smart-contract risk \u2014 professional audit and timelocked, multi-sig admin required before mainnet.",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "4px 0" }}>
                  <span style={{ color: T.gold, fontSize: 10, marginTop: 1, flexShrink: 0 }}>{"\u25B8"}</span>
                  <span style={{ fontFamily: "'Rajdhani'", fontSize: 11, color: T.textSecondary, lineHeight: 1.4 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 9 — Legal Positioning */}
          <div>
            <h2 style={{ fontFamily: "'Montserrat'", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
              9. Legal Positioning
            </h2>
            <p style={{ fontFamily: "'Rajdhani'", fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>
              MOON is a free-floating digital asset, not a lottery ticket, deposit, or redeemable instrument. The oracle reports public information only; the protocol makes no promise of value, return, or buy-back. Nothing here is financial advice. Participants should only commit funds they can afford to lose.
            </p>
          </div>

          {/* Token allocation + pool calculator */}
          <TokenomicsPanel />
          <PoolCalculator oracle={oracle} />

          {/* Legal note */}
          <div style={{ marginTop: 16, padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 6, border: `1px solid ${T.border}` }}>
            <p style={{ fontFamily: "'Nunito Sans'", fontSize: 9, color: T.textMuted, lineHeight: 1.6, textAlign: "center" }}>
              Reference implementation &mdash; requires professional auditing before mainnet deployment. Moonball Labs, 2026. Contact: edgar@moonball.info
            </p>
          </div>
        </Card>

        {/* Footer */}
        <div style={{ textAlign: "center", paddingBottom: 20, paddingTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <MoonLogo size={30} animate />
          </div>
          <div style={{ fontFamily: "'Montserrat'", fontSize: 10, color: "#FFFDD0", letterSpacing: 3, marginTop: 8 }}>
            MOONBALL
          </div>
        </div>
      </main>
    </div>
  );
}

function TokenomicsPanel() {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div style={{ marginTop: 18, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <h2 style={{ fontFamily: "'Montserrat'", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>
        10. Token Allocation
      </h2>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 20, color: T.gold }}>
          {(TOKENOMICS.totalSupply / 1_000_000).toFixed(0)}M MOON
        </span>
        <span style={{ fontSize: 11, color: T.textMuted }}>Fixed supply · minted at genesis</span>
      </div>

      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 8, marginBottom: 12 }}>
        {TOKENOMICS.allocation.map((b) => (
          <div key={b.label} style={{ width: `${b.pct}%`, background: b.color }} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {TOKENOMICS.allocation.map((b, i) => (
          <div
            key={b.label}
            style={{ cursor: "pointer" }}
            onClick={() => setExpanded(expanded === i ? null : i)}
            data-testid={`row-allocation-${i}`}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Rajdhani'", fontSize: 12, color: T.textPrimary }}>{b.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: b.color }}>{b.pct}%</span>
                <span style={{ fontSize: 10, color: T.textMuted }}>{(TOKENOMICS.totalSupply * b.pct / 100 / 1_000_000).toFixed(0)}M</span>
                <span style={{ fontSize: 10, color: T.textMuted }}>{expanded === i ? "▲" : "▼"}</span>
              </div>
            </div>
            {expanded === i && (
              <div style={{ padding: "6px 16px 8px", background: "rgba(0,0,0,0.3)", borderRadius: 8, marginBottom: 2 }}>
                <div style={{ fontFamily: "'Rajdhani'", fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>{b.description}</div>
                <div style={{ marginTop: 4, display: "inline-block", background: `${b.color}18`, color: b.color, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, letterSpacing: 0.5 }}>
                  {b.lockup}
                </div>
                <VestingStatus bucket={b} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
        <div style={{ fontFamily: "'Nunito Sans'", fontSize: 10, color: T.textSecondary, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>FEE FLOW</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: T.textMuted }}>Pool swap fee</span>
            <span style={{ color: "#fff" }}>{TOKENOMICS.poolFeePct}% per swap</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: T.textMuted }}>LP share</span>
            <span style={{ color: T.blue }}>{TOKENOMICS.lpSharePct}% of fee</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: T.textMuted }}>Protocol skim → treasury</span>
            <span style={{ color: T.gold }}>{TOKENOMICS.protocolSkimPct}% of fee</span>
          </div>
          <div style={{ borderTop: `1px dashed ${T.border}`, marginTop: 4, paddingTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.textMuted }}>→ POL reinvestment</span>
              <span style={{ color: T.gold }}>{TOKENOMICS.treasuryPolSplit}% of skim</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.textMuted }}>→ Operations</span>
              <span style={{ color: T.blue }}>{TOKENOMICS.treasuryOpsSplit}% of skim</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
        <div style={{ fontFamily: "'Nunito Sans'", fontSize: 10, color: T.textSecondary, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>FEE GLIDE PATH</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {TOKENOMICS.tvlGlidePath.map((tier, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "'Rajdhani'", fontSize: 11, color: T.textSecondary }}>{tier.label}</span>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: tier.feePct === TOKENOMICS.poolFeePct ? T.gold : T.blue }}>
                {tier.feePct}% fee
              </span>
            </div>
          ))}
          <div style={{ fontFamily: "'Rajdhani'", fontSize: 10, color: T.textMuted, lineHeight: 1.4, marginTop: 4 }}>
            Fee tier steps down as pool depth grows. Deeper pool → lower fee → more volume → more POL.
          </div>
        </div>
      </div>
    </div>
  );
}

function VestingStatus({ bucket }: { bucket: (typeof TOKENOMICS.allocation)[number] }) {
  const v = vestingStatus(bucket);
  if (!v) return null;
  const fmtTokens = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${(n / 1_000).toFixed(0)}K`;
  return (
    <div style={{ marginTop: 10 }} data-testid={`vesting-${bucket.label.toLowerCase()}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontFamily: "'Nunito Sans'", fontSize: 9, color: T.textSecondary, fontWeight: 700, letterSpacing: 1 }}>ON-CHAIN LOCK</span>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: v.unlockedPct > 0 ? T.gold : bucket.color }} data-testid={`text-locked-pct-${bucket.label.toLowerCase()}`}>
          {v.lockedPct.toFixed(v.lockedPct % 1 === 0 ? 0 : 1)}% locked
        </span>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
        <div style={{ width: `${v.unlockedPct}%`, background: T.gold }} />
        <div style={{ width: `${v.lockedPct}%`, background: bucket.color }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontFamily: "'Share Tech Mono', monospace", fontSize: 10 }}>
        <span style={{ color: T.gold }}>{fmtTokens(v.unlockedTokens)} unlocked</span>
        <span style={{ color: bucket.color }}>{fmtTokens(v.lockedTokens)} locked</span>
      </div>
      <div style={{ fontFamily: "'Rajdhani'", fontSize: 10, color: T.textMuted, marginTop: 5, lineHeight: 1.4 }}>
        {TOKENOMICS.vestingStart
          ? v.started
            ? "Enforced by an on-chain MoonVestingWallet (cliff + linear vest). Anyone can verify the locked balance on-chain."
            : "Vesting begins at the scheduled start. Until then the full allocation is locked on-chain."
          : "Vesting wallet not deployed yet — the full allocation will be locked on-chain at TGE via a MoonVestingWallet."}
      </div>
    </div>
  );
}

function PoolCalculator({ oracle }: { oracle?: OracleModel }) {
  const [dailyVol, setDailyVol] = useState("50000");
  const [maxImpact, setMaxImpact] = useState("1");
  const launchPrice = oracle?.riskAdjustedValue ?? null;
  const result = (() => {
    const vol = parseFloat(dailyVol);
    const impact = parseFloat(maxImpact);
    if (!launchPrice || isNaN(vol) || isNaN(impact) || vol <= 0 || impact <= 0 || impact > 50) return null;
    const usdcNeeded = vol * 0.05 / (impact / 100);
    const moonNeeded = usdcNeeded / launchPrice;
    const totalTvl = usdcNeeded * 2;
    const pctOfSupply = (moonNeeded / TOKENOMICS.totalSupply) * 100;
    return { usdcNeeded, moonNeeded, totalTvl, pctOfSupply };
  })();
  const inputStyle = {
    background: "rgba(0,0,0,0.4)",
    border: `1px solid rgba(255,255,255,0.08)`,
    borderRadius: 8,
    padding: "8px 10px",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 14,
    color: T.gold,
    outline: "none",
    width: "100%",
  } as const;
  return (
    <div style={{ marginTop: 14, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontFamily: "'Montserrat'", fontSize: 12, fontWeight: 700, color: T.gold, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>
        11. Pool Size Calculator
      </div>
      <div style={{ fontFamily: "'Rajdhani'", fontSize: 11, color: T.textMuted, marginBottom: 14, lineHeight: 1.4 }}>
        How much should we seed in the MOON/USDC pool? Enter expected daily trading volume and your target max price impact per trade.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Nunito Sans'", fontSize: 10, color: T.textSecondary, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>DAILY VOLUME ($)</div>
          <input data-testid="input-daily-volume" type="number" min="1000" value={dailyVol} onChange={(e) => setDailyVol(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={{ fontFamily: "'Nunito Sans'", fontSize: 10, color: T.textSecondary, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>MAX IMPACT (%)</div>
          <input data-testid="input-max-impact" type="number" min="0.1" max="50" step="0.5" value={maxImpact} onChange={(e) => setMaxImpact(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 8 }}>
        <span style={{ fontFamily: "'Rajdhani'", fontSize: 11, color: T.textMuted }}>Launch price anchor</span>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: T.gold }}>
          {launchPrice ? formatUsd(launchPrice) + " / MOON" : "—  (oracle loading)"}
        </span>
      </div>
      <div style={{ fontFamily: "'Rajdhani'", fontSize: 10, color: T.textMuted, marginBottom: 12, lineHeight: 1.4 }}>
        Launch price = oracle's risk-adjusted value for the current jackpot. Sets MOON/USDC seed ratio.
      </div>
      {result ? (
        <div style={{ background: `${T.gold}08`, border: `1px solid ${T.gold}33`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontFamily: "'Nunito Sans'", fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>RECOMMENDED SEED</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { label: "MOON to seed", value: result.moonNeeded >= 1_000_000 ? `${(result.moonNeeded / 1_000_000).toFixed(2)}M` : `${Math.round(result.moonNeeded).toLocaleString()}`, testid: "result-moon-seed" },
              { label: "USDC to seed", value: result.usdcNeeded >= 1_000_000 ? `$${(result.usdcNeeded / 1_000_000).toFixed(2)}M` : `$${Math.round(result.usdcNeeded).toLocaleString()}`, testid: "result-usdc-seed" },
              { label: "Pool TVL", value: result.totalTvl >= 1_000_000 ? `$${(result.totalTvl / 1_000_000).toFixed(2)}M` : `$${Math.round(result.totalTvl).toLocaleString()}`, testid: "result-pool-tvl" },
              { label: "% of supply", value: `${result.pctOfSupply.toFixed(2)}%`, testid: "result-pct-supply" },
            ].map((r) => (
              <div key={r.label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontFamily: "'Rajdhani'", fontSize: 10, color: T.textMuted }}>{r.label}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 14, color: "#fff", marginTop: 2 }} data-testid={r.testid}>{r.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: T.textPrimary, textAlign: "center", padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
            Seed {result.moonNeeded >= 1_000_000 ? `${(result.moonNeeded / 1_000_000).toFixed(2)}M` : Math.round(result.moonNeeded).toLocaleString()} MOON
            {" + "}
            {result.usdcNeeded >= 1_000_000 ? `$${(result.usdcNeeded / 1_000_000).toFixed(2)}M` : `$${Math.round(result.usdcNeeded).toLocaleString()}`} USDC
            {" → launch price "}
            <span style={{ color: T.gold }}>{formatUsd(launchPrice!)}</span>
          </div>
          <div style={{ fontFamily: "'Rajdhani'", fontSize: 10, color: T.textMuted, marginTop: 8, lineHeight: 1.4, textAlign: "center" }}>
            Assumes largest single trade ≈ 5% of daily volume. Formula: USDC = vol × 0.05 / impact.
          </div>
        </div>
      ) : (
        <div style={{ padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, fontFamily: "'Rajdhani'", fontSize: 11, color: T.textMuted, textAlign: "center" }}>
          {!launchPrice ? "Waiting for oracle data…" : "Enter valid inputs above"}
        </div>
      )}
    </div>
  );
}
