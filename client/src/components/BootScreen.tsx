import { useState, useEffect } from "react";
import { MoonLogo } from "./MoonLogo";
import { T } from "@/lib/constants";

const bootLines = [
  "MOONBALL PROTOCOL",
  "Initializing public data feeds...",
  "Preparing the reference model...",
  "Loading jackpot history...",
  "MOON market price: set by traders",
  "No peg or redemption",
  "Pre-launch experience",
  "SYSTEM READY",
];

export function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const timers: number[] = [];
    bootLines.forEach((line, i) => {
      timers.push(window.setTimeout(() => {
        setLines((prev) => [...prev, line]);
        if (i === bootLines.length - 1) {
          timers.push(window.setTimeout(onComplete, 600));
        }
      }, i * 280));
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [onComplete]);

  return (
    <div
      role="status"
      aria-label="Loading Moonball"
      data-testid="boot-screen"
      style={{
        position: "fixed",
        inset: 0,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "32px 24px",
        zIndex: 9999,
        fontFamily: "'Nunito Sans', monospace",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <MoonLogo size={64} animate />
      </div>
      <div
        style={{
          color: T.gold,
          fontSize: 11,
          letterSpacing: 1.5,
          marginBottom: 32,
          opacity: 0.5,
        }}
      >
        {">"} MOONBALL SYSTEMS
      </div>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            color: line === "SYSTEM READY" ? T.gold : T.textSecondary,
            fontSize: 12,
            lineHeight: 2.2,
            animation: "boot-text 0.3s ease",
            letterSpacing: 0.5,
          }}
        >
          <span style={{ color: T.textMuted, marginRight: 8 }}>{">"}</span>
          {line}
        </div>
      ))}
      <div
        style={{
          marginTop: 40,
          height: 2,
          background: "#111827",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background: `linear-gradient(90deg, ${T.blue}, ${T.gold})`,
            width: `${(lines.length / bootLines.length) * 100}%`,
            transition: "width 0.3s ease",
            boxShadow: `0 0 12px ${T.glowBlue}`,
          }}
        />
      </div>
    </div>
  );
}
