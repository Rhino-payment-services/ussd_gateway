import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Variant = "default" | "outline" | "ghost" | "secondary";

const variants: Record<Variant, string> = {
  default: "bg-accent text-accent-foreground hover:opacity-90",
  outline: "border border-border bg-transparent hover:bg-card",
  ghost: "hover:bg-card",
  secondary: "bg-card text-foreground ring-1 ring-border hover:bg-card/80",
};

export function Button({
  className,
  variant = "default",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        className,
      )}
      {...p}
    />
  );
}
