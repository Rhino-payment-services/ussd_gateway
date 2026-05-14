import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/80 text-foreground shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md",
        className,
      )}
      {...p}
    />
  );
}

export function CardHeader({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 border-b border-border/60 p-5 pb-3", className)} {...p} />;
}

export function CardTitle({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold tracking-tight text-muted", className)} {...p} />;
}

export function CardContent({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-3", className)} {...p} />;
}
