import { T } from "@/lib/constants";

export function WinningNumbers({ numbers, powerball }: { numbers: number[], powerball: number }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        justifyContent: "flex-start",
        flexWrap: "wrap",
      }}
    >
      {numbers.map((n, i) => (
        <div
          key={i}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${T.borderBlue}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Montserrat'",
            fontSize: 11,
            fontWeight: 600,
            color: "#e0e0e0",
          }}
        >
          {n}
        </div>
      ))}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: `${T.gold}22`,
          border: `1px solid ${T.gold}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Montserrat'",
          fontSize: 11,
          fontWeight: 700,
          color: T.gold,
        }}
      >
        {powerball}
      </div>
    </div>
  );
}
