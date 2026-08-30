import type { Category } from "../../core/schema.ts";
import { cn } from "@/lib/utils";

/**
 * The one status glyph, used in list rows, header pills, and sidebar titles. A status-colored square
 * for now; swap this component for real icons later and every list follows.
 */
export function StatusIcon({ category, className }: { category: Category; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-sm", className)} style={{ background: `var(--status-${category})` }} />;
}
