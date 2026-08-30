import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { TooltipProvider } from "@/components/ui/tooltip";

createRoot(document.getElementById("root")!).render(
  <TooltipProvider delayDuration={300}>
    <App />
  </TooltipProvider>,
);
