import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Badge({ className, ...p }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted",
        className,
      )}
      {...p}
    />
  );
}
