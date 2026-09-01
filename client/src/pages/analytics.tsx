import { useQuery } from "@tanstack/react-query";
import { T } from "@/lib/constants";
import { useLocation } from "wouter";
import { useState } from "react";

export default function Analytics() {
  const [, navigate] = useLocation();
  const [days, setDays] = useState(30);

  const token = import.meta.env.VITE_ANALYTICS_TOKEN || "";

  const { data, isLoading, isError } = useQuery<{
    totalPageViews: number;
    uniqueVisitors: number;
    pageBreakdown: { path: string; views: number }[];
    eventBreakdown: { eventName: string; count: number }[];
    dailyViews: { date: string; views: number; unique: number }[];
    recentEvents: { eventName: string; path: string; createdAt: string }[];
  }>({
    queryKey: ["/api/analytics/summary", days, token],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/summary?days=${days}&token=${token}`);
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!token,
  });

  const cardStyle: React.CSSProperties = {
    background: "rgba(14,18,30,0.95)",
    border: "1px solid rgba(245,166,35,0.15)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  };

  const labelStyle: React.CSSProperties = {
    color: T.textSecondary,
    fontSize: 12,
    fontFamily: "'Nunito Sans', sans-serif",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  };

  const valueStyle: React.CSSProperties = {
    color: T.gold,
    fontSize: 32,
    fontFamily: "'Bebas Neue', sans-serif",
    lineHeight: 1,
  };

  const maxViews = data?.dailyViews ? Math.max(...data.dailyViews.map((d) => d.views), 1) : 1;

  return (
    <div
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        background: T.bg,
        minHeight: "100vh",
        maxWidth: 600,
        margin: "0 auto",
        padding: "20px 16px 40px",
        color: T.textPrimary,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: T.gold,
            margin: 0,
          }}
          data-testid="text-analytics-title"
        >
          Moonball Analytics
        </h1>
        <button
          onClick={() => navigate("/")}
          data-testid="button-back-home"
          style={{
            background: "rgba(245,166,35,0.15)",
            border: "1px solid rgba(245,166,35,0.3)",
            borderRadius: 8,
            padding: "6px 14px",
            color: T.gold,
            fontSize: 13,
            fontFamily: "'Rajdhani', sans-serif",
            cursor: "pointer",
          }}
        >
          Back to Dashboard
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            data-testid={`button-days-${d}`}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              border: days === d ? `1px solid ${T.gold}` : "1px solid rgba(107,122,148,0.3)",
              background: days === d ? "rgba(245,166,35,0.15)" : "transparent",
              color: days === d ? T.gold : T.textSecondary,
              fontSize: 13,
              fontFamily: "'Rajdhani', sans-serif",
              cursor: "pointer",
              fontWeight: days === d ? 700 : 400,
            }}
          >
            {d}d
          </button>
        ))}
      </div>

      {!token ? (
        <div style={{ textAlign: "center", color: "#ef4444", padding: 40 }}>Access denied. Analytics token not configured.</div>
      ) : isLoading ? (
        <div style={{ textAlign: "center", color: T.textSecondary, padding: 40 }}>Loading analytics...</div>
      ) : isError || !data ? (
        <div style={{ textAlign: "center", color: "#ef4444", padding: 40 }}>Failed to load analytics data.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={cardStyle} data-testid="card-total-views">
              <div style={labelStyle}>Total Page Views</div>
              <div style={valueStyle}>{data.totalPageViews.toLocaleString()}</div>
            </div>
            <div style={cardStyle} data-testid="card-unique-visitors">
              <div style={labelStyle}>Unique Visitors</div>
              <div style={valueStyle}>{data.uniqueVisitors.toLocaleString()}</div>
            </div>
          </div>

          {data.dailyViews.length > 0 && (
            <div style={cardStyle}>
              <div style={{ ...labelStyle, marginBottom: 12 }}>Daily Traffic</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 100 }} data-testid="chart-daily-traffic">
                {data.dailyViews.map((day) => (
                  <div
                    key={day.date}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        background: `linear-gradient(to top, ${T.gold}, ${T.goldLight})`,
                        borderRadius: "3px 3px 0 0",
                        height: `${Math.max((day.views / maxViews) * 80, 4)}px`,
                        minWidth: 6,
                        opacity: 0.85,
                      }}
                      title={`${day.date}: ${day.views} views, ${day.unique} unique`}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: T.textSecondary }}>
                  {data.dailyViews[0]?.date.slice(5) || ""}
                </span>
                <span style={{ fontSize: 10, color: T.textSecondary }}>
                  {data.dailyViews[data.dailyViews.length - 1]?.date.slice(5) || ""}
                </span>
              </div>
            </div>
          )}

          {data.pageBreakdown.length > 0 && (
            <div style={cardStyle}>
              <div style={{ ...labelStyle, marginBottom: 12 }}>Pages</div>
              {data.pageBreakdown.map((p) => (
                <div
                  key={p.path}
                  data-testid={`row-page-${p.path}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(107,122,148,0.1)",
                  }}
                >
                  <span style={{ color: T.textPrimary, fontSize: 14 }}>{p.path}</span>
                  <span style={{ color: T.gold, fontSize: 14, fontFamily: "'Bebas Neue', sans-serif" }}>
                    {p.views}
                  </span>
                </div>
              ))}
            </div>
          )}

          {data.eventBreakdown.length > 0 && (
            <div style={cardStyle}>
              <div style={{ ...labelStyle, marginBottom: 12 }}>User Interactions</div>
              {data.eventBreakdown.map((e) => {
                const friendlyNames: Record<string, string> = {
                  scroll_depth: "Scrolled Page",
                  nav_click: "Navigation Clicks",
                  waitlist_signup: "Waitlist Signups",
                  calc_interaction: "Calculator Simulations",
                };
                return (
                  <div
                    key={e.eventName}
                    data-testid={`row-event-${e.eventName}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid rgba(107,122,148,0.1)",
                    }}
                  >
                    <span style={{ color: T.textPrimary, fontSize: 14 }}>
                      {friendlyNames[e.eventName] || e.eventName}
                    </span>
                    <span style={{ color: T.blue, fontSize: 14, fontFamily: "'Bebas Neue', sans-serif" }}>
                      {e.count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {data.recentEvents.length > 0 && (
            <div style={cardStyle}>
              <div style={{ ...labelStyle, marginBottom: 12 }}>Recent Activity</div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {data.recentEvents.slice(0, 20).map((evt, i) => {
                  const friendlyNames: Record<string, string> = {
                    scroll_depth: "Scrolled",
                    nav_click: "Nav click",
                    waitlist_signup: "Waitlist signup",
                    calc_interaction: "Calculator used",
                  };
                  const time = new Date(evt.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 0",
                        borderBottom: "1px solid rgba(107,122,148,0.06)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: T.textPrimary }}>
                        {friendlyNames[evt.eventName] || evt.eventName}
                      </span>
                      <span style={{ color: T.textSecondary, fontSize: 11 }}>{time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
