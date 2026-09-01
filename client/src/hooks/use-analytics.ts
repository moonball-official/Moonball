import { useEffect, useRef, useCallback } from "react";

function getVisitorId(): string {
  let id = localStorage.getItem("moonball_vid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("moonball_vid", id);
  }
  return id;
}

function sendBeacon(payload: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/track", blob);
  } else {
    fetch("/api/analytics/track", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  }
}

export function usePageView(path: string) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    sendBeacon({
      type: "pageview",
      path,
      visitorId: getVisitorId(),
      referrer: document.referrer || undefined,
      userAgent: navigator.userAgent,
    });
  }, [path]);
}

export function useTrackEvent() {
  return useCallback((eventName: string, eventData?: Record<string, unknown>) => {
    sendBeacon({
      type: "event",
      path: window.location.pathname,
      visitorId: getVisitorId(),
      eventName,
      eventData,
    });
  }, []);
}

export function useScrollDepth(thresholds: number[] = [25, 50, 75, 100]) {
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const handler = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.round((scrollTop / docHeight) * 100);

      for (const t of thresholds) {
        if (pct >= t && !firedRef.current.has(t)) {
          firedRef.current.add(t);
          sendBeacon({
            type: "event",
            path: window.location.pathname,
            visitorId: getVisitorId(),
            eventName: "scroll_depth",
            eventData: { depth: t },
          });
        }
      }
    };

    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [thresholds]);
}
