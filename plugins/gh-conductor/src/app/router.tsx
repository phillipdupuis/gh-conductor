import { useEffect } from "react";
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { App } from "./App.tsx";
import { parseEpicParams, ping } from "./api.ts";
import { useAppStore } from "./store.ts";
import { TooltipProvider } from "@/components/ui/tooltip";

function Root() {
  // The keepalive belongs to the app, not to any one epic: it must outlive route changes.
  useEffect(() => {
    const id = setInterval(() => void ping(), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <Outlet />
    </TooltipProvider>
  );
}

function Landing() {
  return (
    <main className="flex h-full items-center justify-center p-8">
      <div className="max-w-md space-y-3 text-sm text-muted-foreground">
        <h1 className="text-lg font-semibold text-foreground">gh-conductor</h1>
        <p>
          Open an epic with <code className="rounded bg-muted px-1 py-0.5">conductor view &lt;epic&gt;</code>, or visit{" "}
          <code className="rounded bg-muted px-1 py-0.5">/&lt;owner&gt;/&lt;repo&gt;/&lt;number&gt;</code>.
        </p>
      </div>
    </main>
  );
}

const rootRoute = createRootRoute({ component: Root, notFoundComponent: Landing });

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Landing });

const epicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$owner/$repo/$number",
  params: {
    parse: parseEpicParams,
    stringify: (p) => ({ owner: p.owner, repo: p.repo, number: String(p.number) }),
  },
  // Fire-and-forget on purpose: awaiting would block the render behind the fetch, and the store's
  // Load union already drives the loading and error UI.
  loader: ({ params }) => {
    const s = useAppStore.getState();
    s.init(params);
    void s.refresh();
  },
  component: App,
});

const routeTree = rootRoute.addChildren([indexRoute, epicRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
