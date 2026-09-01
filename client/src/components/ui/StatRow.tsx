import { T } from "@/lib/constants";

export function SectionLabel({
  icon,
  text,
  as: Tag = "div",
}: {
  icon: string;
  text: string;
  as?: "div" | "h2" | "h3";
}) {
  return (
    <Tag
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        margin: 0,
        marginBottom: 12,
        opacity: 0.9,
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span
        style={{
          fontFamily: "'Montserrat'",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          color: T.gold,
        }}
      >
        {text}
      </span>
    </Tag>
  );
}

export function StatRow({
  label,
  value,
  accent = false,
  accentColor = "gold",
}: {
  label: string;
  value: string;
  accent?: boolean;
  accentColor?: "gold" | "blue" | "green" | "red";
}) {
  const color =
    accentColor === "gold"
      ? T.gold
      : accentColor === "blue"
      ? T.blue
      : accentColor === "green"
      ? "#34D399"
      : accentColor === "red"
      ? "#F87171"
      : T.textPrimary;

  const glow =
    accentColor === "gold"
      ? T.glowGold
      : accentColor === "green"
      ? "rgba(52,211,153,0.3)"
      : accentColor === "red"
      ? "rgba(248,113,113,0.3)"
      : T.glowBlue;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
        fontSize: 13,
      }}
    >
      <span style={{ color: T.textSecondary, fontFamily: "'Nunito Sans'" }}>
        {label}
      </span>
      <span
        style={{
          color: accent ? color : T.textPrimary,
          fontFamily: "'Nunito Sans'",
          fontWeight: accent ? 600 : 400,
          textShadow: accent ? `0 0 8px ${glow}` : "none",
        }}
      >
        {value}
      </span>
    </div>
  );
}
