import { useState, useEffect } from "react";
import { T } from "@/lib/constants";

interface CountdownProps {
  targetISO?: string;
}

export function Countdown({ targetISO }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const target = targetISO
      ? new Date(targetISO).getTime()
      : getNextDrawTime().getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const dist = target - now;
      if (dist < 0) {
        setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
      } else {
        setTimeLeft({
          days: Math.floor(dist / (1000 * 60 * 60 * 24)),
          hours: Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          mins: Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60)),
          secs: Math.floor((dist % (1000 * 60)) / 1000),
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetISO]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
        marginTop: 10,
      }}
    >
      {Object.entries(timeLeft).map(([label, val]) => (
        <div
          key={label}
          style={{
            background: "rgba(0,0,0,0.3)",
            borderRadius: 8,
            padding: "8px 0",
            textAlign: "center",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              fontFamily: "'Montserrat'",
              fontSize: 20,
              fontWeight: 700,
              color: T.textPrimary,
              animation:
                label === "secs" ? "countdown-pulse 1s infinite" : "none",
            }}
          >
            {val < 10 ? `0${val}` : val}
          </div>
          <div
            style={{
              fontFamily: "'Nunito Sans'",
              fontSize: 9,
              color: T.textMuted,
              textTransform: "uppercase",
              marginTop: 2,
              letterSpacing: 1,
            }}
          >
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

function getNextDrawTime(): Date {
  const drawDays = [1, 3, 6]; // Mon, Wed, Sat
  const now = new Date();

  for (let i = 0; i <= 7; i++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + i);
    const etStr = candidate.toLocaleString("en-US", { timeZone: "America/New_York" });
    const etDate = new Date(etStr);
    const dayOfWeek = etDate.getDay();

    if (drawDays.includes(dayOfWeek)) {
      const drawTime = new Date(candidate);
      drawTime.setHours(22, 59, 0, 0);
      if (drawTime > now) {
        return drawTime;
      }
    }
  }
  return now;
}
