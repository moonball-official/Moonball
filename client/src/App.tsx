import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import TechnicalPaper from "@/pages/technical-paper";
import Analytics from "@/pages/analytics";
import NotFound from "@/pages/not-found";

// Lazy-loaded so ethers / web3 code stays out of the main dashboard bundle.
const Protocol = lazy(() => import("@/pages/protocol"));

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/technical-paper" component={TechnicalPaper} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/protocol">
        <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0B0E17" }} />}>
          <Protocol />
        </Suspense>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
