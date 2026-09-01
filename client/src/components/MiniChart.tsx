export function MiniChart({ data, width = 300, height = 140 }: { data: any[], width?: number, height?: number }) {
  const pad = { top: 24, right: 10, bottom: 10, left: 10 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  if (!data || data.length === 0) return null;

  if (data.length === 1) {
    const cx = pad.left + w / 2;
    const cy = pad.top + h / 2;
    return (
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <line
          x1={pad.left}
          y1={cy}
          x2={pad.left + w}
          y2={cy}
          stroke="#F5A623"
          strokeWidth="1.5"
          strokeDasharray="4,5"
          opacity="0.35"
        />
        <circle cx={cx} cy={cy} r="6" fill="#F5A623" opacity="0.15" />
        <circle cx={cx} cy={cy} r="4" fill="#F5A623" opacity="0.9" />
        <text
          x={cx}
          y={cy - 14}
          fill="#F5A623"
          fontSize="12"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="'Montserrat'"
        >
          ${data[0].jackpot}M
        </text>
        <text
          x={cx}
          y={cy + 22}
          fill="#F5A623"
          fontSize="9"
          textAnchor="middle"
          fontFamily="'Nunito Sans'"
          opacity="0.5"
          letterSpacing="1"
        >
          CYCLE RESET — {data[0].date}
        </text>
      </svg>
    );
  }

  const max = Math.max(...data.map((d) => d.jackpot));
  const min = Math.min(...data.map((d) => d.jackpot));
  const range = max - min || 1;

  const points = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * w,
    y: pad.top + h - ((d.jackpot - min) / range) * h,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const areaD =
    pathD +
    ` L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  const peakIdx = data.reduce((maxI: number, d: any, i: number) => d.jackpot > data[maxI].jackpot ? i : maxI, 0);
  const peakPt = points[peakIdx];
  const isNearRight = peakIdx > data.length * 0.7;
  const isNearLeft = peakIdx < data.length * 0.3;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id="miniChartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5A623" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#miniChartGrad)" />
      <path
        d={pathD}
        fill="none"
        stroke="#F5A623"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 4 : 2}
          fill="#F5A623"
        />
      ))}
      <text
        x={peakPt.x}
        y={peakPt.y - 10}
        fill="#F5A623"
        fontSize="12"
        fontWeight="700"
        textAnchor={isNearRight ? "end" : isNearLeft ? "start" : "middle"}
        fontFamily="'Montserrat'"
      >
        ${data[peakIdx].jackpot}M
      </text>
    </svg>
  );
}
