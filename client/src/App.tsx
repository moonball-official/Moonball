import { Switch, Route } from "wouter";
import { lazy, Suspense, useCallback, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import TechnicalPaper from "@/pages/technical-paper";
import Analytics from "@/pages/analytics";
import NotFound from "@/pages/not-found";
import { BootScreen } from "@/components/BootScreen";

const BOOT_SEEN_KEY = "moonball-boot-seen";

function shouldShowBootScreen() {
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  const isRefresh = navigation?.type === "reload";

  try {
    const hasVisited = sessionStorage.getItem(BOOT_SEEN_KEY) === "1";
    sessionStorage.setItem(BOOT_SEEN_KEY, "1");
    return !hasVisited || isRefresh;
  } catch {
    return true;
  }
}

// Lazy-loaded so ethers / web3 code stays out of the main dashboard bundle.
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Protocol = lazy(() => import("@/pages/protocol"));

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard">
        <Suspense
          fallback={
            <div role="status" style={{ padding: 40 }}>
              Loading dashboard…
            </div>
          }
        >
          <Dashboard />
        </Suspense>
      </Route>
      <Route path="/technical-paper" component={TechnicalPaper} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/protocol">
        <Suspense
          fallback={
            <div style={{ minHeight: "100vh", background: "#0B0E17" }} />
          }
        >
          <Protocol />
        </Suspense>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showBoot, setShowBoot] = useState(shouldShowBootScreen);
  const completeBoot = useCallback(() => setShowBoot(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        {showBoot && <BootScreen onComplete={completeBoot} />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
