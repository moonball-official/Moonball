import { T } from "@/lib/constants";

export function MultiCycleChart({ cycles, activeCycleId, onSelectCycle }: any) {
  const W = 340;
  const H = 180;
  const PAD = { top: 16, right: 12, bottom: 28, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allJackpots = cycles.flatMap((c: any) => c.draws.map((d: any) => d.jackpot));
  const globalMax = Math.max(...allJackpots);
  const globalMin = 0;
  const range = globalMax - globalMin || 1;

  const totalDraws = cycles.reduce((sum: number, c: any) => sum + c.draws.length, 0);
  const gapDraws = 1.5;
  const totalX = totalDraws + gapDraws * (cycles.length - 1);

  let drawOffset = 0;
  const cycleSegments = cycles.map((cycle: any, ci: number) => {
    const start = drawOffset;
    const points = cycle.draws.map((d: any, i: number) => ({
      x: PAD.left + ((start + i) / (totalX - 1)) * chartW,
      y: PAD.top + chartH - ((d.jackpot - globalMin) / range) * chartH,
      jackpot: d.jackpot,
      date: d.date,
    }));
    drawOffset += cycle.draws.length + gapDraws;
    const isCurrentCycle = !cycle.winner;
    return { ...cycle, points, isCurrentCycle, cycleIndex: ci };

  });

  const yTicks = [0, 200, 400, 600];
  const toY = (v: number) => PAD.top + chartH - ((v - globalMin) / range) * chartH;

  return (
    <div style={{ position: "relative" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          {cycleSegments.map((seg: any) => (
            <linearGradient
              key={`grad-${seg.id}`}
              id={`grad-${seg.id}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={seg.color}
                stopOpacity={seg.id === activeCycleId ? "0.28" : "0.10"}
              />
              <stop offset="100%" stopColor={seg.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {yTicks.map((v) => {
          const y = toY(v);
          if (y < PAD.top || y > PAD.top + chartH + 2) return null;
          return (
            <g key={v}>
              <line
                x1={PAD.left}
                y1={y}
                x2={PAD.left + chartW}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
                strokeDasharray="3,4"
              />
              <text
                x={PAD.left - 5}
                y={y + 3}
                fill={T.textMuted}
                fontSize="7"
                textAnchor="end"
                fontFamily="'Nunito Sans'"
              >
                {v > 0 ? `$${v}M` : "$0"}
              </text>
            </g>
          );
        })}

        <line
          x1={PAD.left}
          y1={PAD.top + chartH}
          x2={PAD.left + chartW}
          y2={PAD.top + chartH}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />

        {cycleSegments.map((seg: any) => {
          const isActive = seg.id === activeCycleId;
          const pts = seg.points;
          if (pts.length < 2) {
            if (pts.length === 1 && seg.isCurrentCycle) {
              return (
                <g
                  key={seg.id}
                  onClick={() => onSelectCycle(seg.id)}
                  style={{ cursor: "pointer" }}
                >
                  <line
                    x1={pts[0].x}
                    y1={pts[0].y}
                    x2={pts[0].x}
                    y2={PAD.top + chartH}
                    stroke={seg.color}
                    strokeWidth="1"
                    strokeDasharray="2,3"
                    opacity={isActive ? 0.7 : 0.2}
                  />
                  <circle
                    cx={pts[0].x}
                    cy={pts[0].y}
                    r="3.5"
                    fill={seg.color}
                    opacity={isActive ? 0.9 : 0.4}
                  />
                  <text
                    x={pts[0].x + 3}
                    y={pts[0].y - 6}
                    fill={seg.color}
                    fontSize="7"
                    fontFamily="'Nunito Sans'"
                    opacity={isActive ? 1 : 0.4}
                  >
                    NOW
                  </text>
                </g>
              );
            }
            return null;
          }

          const lineD = pts
            .map(
              (p: any, i: number) =>
                `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`
            )
            .join(" ");
          const areaD =
            lineD +
            ` L${pts[pts.length - 1].x.toFixed(1)},${(PAD.top + chartH).toFixed(1)}` +
            ` L${pts[0].x.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;

          return (
            <g
              key={seg.id}
              onClick={() => onSelectCycle(seg.id)}
              style={{ cursor: "pointer" }}
            >
              <path d={areaD} fill={`url(#grad-${seg.id})`} />

              <path
                d={lineD}
                fill="none"
                stroke={seg.color}
                strokeWidth={isActive ? 2.5 : 1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isActive ? 1 : 0.4}
              />

              <line
                x1={pts[0].x}
                y1={PAD.top}
                x2={pts[0].x}
                y2={PAD.top + chartH}
                stroke={seg.color}
                strokeWidth="1"
                strokeDasharray="2,3"
                opacity={isActive ? 0.7 : 0.2}
              />

              <text
                x={pts[0].x + 3}
                y={PAD.top + 8}
                fill={seg.color}
                fontSize="7"
                fontFamily="'Nunito Sans'"
                opacity={isActive ? 1 : 0.4}
              >
                {seg.isCurrentCycle ? "NOW" : `C${seg.id}`}
              </text>

              {(() => {
                const peakPt = pts.reduce(
                  (max: any, p: any) => (p.y < max.y ? p : max),
                  pts[0]
                );
                return (
                  <g>
                    <circle
                      cx={peakPt.x}
                      cy={peakPt.y}
                      r={isActive ? 4.5 : 2.5}
                      fill={seg.isCurrentCycle ? "none" : seg.color}
                      stroke={seg.color}
                      strokeWidth={isActive ? 2 : 1}
                      opacity={isActive ? 1 : 0.5}
                    />
                    {isActive && (
                      <text
                        x={peakPt.x}
                        y={peakPt.y - 8}
                        fill={seg.color}
                        fontSize="8"
                        textAnchor="middle"
                        fontFamily="'Nunito Sans'"
                      >
                        ${peakPt.jackpot}M
                      </text>
                    )}
                    {seg.winner && isActive && (
                      <text
                        x={peakPt.x}
                        y={peakPt.y - 18}
                        fontSize="9"
                        textAnchor="middle"
                      >
                        🏆
                      </text>
                    )}
                  </g>
                );
              })()}

              {seg.isCurrentCycle &&
                (() => {
                  const last = pts[pts.length - 1];
                  return (
                    <g>
                      <circle
                        cx={last.x}
                        cy={last.y}
                        r="6"
                        fill={T.gold}
                        opacity="0.18"
                      />
                      <circle
                        cx={last.x}
                        cy={last.y}
                        r="3.5"
                        fill={T.gold}
                        style={{ filter: `drop-shadow(0 0 4px ${T.glowGold})` }}
                      />
                    </g>
                  );
                })()}
            </g>
          );
        })}
      </svg>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 12,
          padding: "0 4px",
        }}
      >
        {cycleSegments.map((seg: any) => {
          const isActive = seg.id === activeCycleId;
          const peakVal = seg.peak || Math.max(...seg.draws.map((d: any) => d.jackpot));
          return (
            <button
              key={seg.id}
              data-testid={`button-cycle-${seg.id}`}
              onClick={() => onSelectCycle(seg.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: isActive ? `${seg.color}15` : "transparent",
                border: `1px solid ${
                  isActive ? seg.color + "44" : "rgba(255,255,255,0.05)"
                }`,
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: seg.color,
                  opacity: isActive ? 1 : 0.35,
                }}
              />
              <span
                style={{
                  fontFamily: "'Nunito Sans'",
                  fontSize: 9,
                  color: isActive ? seg.color : T.textMuted,
                  letterSpacing: 0.8,
                }}
              >
                {seg.winner
                  ? `${seg.label} · $${seg.peak}M 🏆`
                  : `${seg.label} · $${peakVal}M ↑`}
              </span>
            </button>
          );
        })}
      </div>

      {(() => {
        const sel = cycleSegments.find((s: any) => s.id === activeCycleId);
        if (!sel) return null;
        const drawCount = sel.winner ? sel.draws.length : Math.max(0, sel.draws.length - 1);
        return (
          <div
            style={{
              marginTop: 12,
              background: `${sel.color}08`,
              border: `1px solid ${sel.color}20`,
              borderRadius: 8,
              padding: "10px 12px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
            }}
          >
            {[
              { label: "PEAK", value: sel.peak ? `$${sel.peak}M` : `$${Math.max(...sel.draws.map((d: any) => d.jackpot))}M+` },
              { label: "DRAWS", value: `${drawCount}` },
              {
                label: "STATUS",
                value: sel.winner ? `WON ${sel.winner}` : "ACTIVE",
              },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: "'Nunito Sans'",
                    fontSize: 7,
                    color: T.textMuted,
                    letterSpacing: 1.5,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontFamily: "'Nunito Sans'",
                    fontSize: 11,
                    color: sel.color,
                    marginTop: 3,
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
