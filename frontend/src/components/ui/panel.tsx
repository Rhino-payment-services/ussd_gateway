import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Quiet bordered surface — prefer over nested Card-in-Card. */
export function Panel({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-border bg-card text-card-foreground", className)} {...p} />;
}

export function PanelHeader({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between gap-2 border-b border-border px-4 py-2.5", className)}
      {...p}
    />
  );
}

export function PanelTitle({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)} {...p} />
  );
}

export function PanelBody({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...p} />;
}
