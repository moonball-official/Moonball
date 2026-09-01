import { T } from "@/lib/constants";

export type CyclePhase = "RESET" | "GROWTH" | "DRAWING" | "WINNER";

export function PhaseIndicator({ activePhase = "GROWTH" }: { activePhase?: CyclePhase }) {
  const steps: { label: CyclePhase }[] = [
    { label: "RESET" },
    { label: "GROWTH" },
    { label: "DRAWING" },
    { label: "WINNER" },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 10,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 20,
          right: 20,
          height: 2,
          background: "rgba(255,255,255,0.05)",
          zIndex: 0,
        }}
      />
      {steps.map((step, i) => {
        const isActive = step.label === activePhase;
        return (
          <div
            key={i}
            data-testid={`phase-${step.label.toLowerCase()}`}
            style={{
              position: "relative",
              zIndex: 1,
              textAlign: "center",
              width: 60,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                margin: "0 auto",
                borderRadius: "50%",
                background: isActive ? T.gold : T.bg,
                border: `2px solid ${isActive ? T.gold : "rgba(255,255,255,0.1)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isActive ? `0 0 12px ${T.glowGold}` : "none",
              }}
            >
              {isActive && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#fff",
                  }}
                />
              )}
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: "'Nunito Sans'",
                fontSize: 8,
                color: isActive ? T.gold : T.textMuted,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
