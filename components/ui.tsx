import * as React from "react";
import { clsx } from "clsx";

export function cn(...classes: Array<string | undefined | null | false>) {
  return clsx(classes);
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }
) {
  const { className, variant = "primary", ...rest } = props;
  return (
    <button
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
        "focus:outline-none focus:ring-2 focus:ring-accent/45 disabled:opacity-50 disabled:cursor-not-allowed",
        "active:translate-y-px",
        // unified highlight / glow for all buttons
        "hover:shadow-[0_0_0_1px_rgba(16,185,129,0.22),0_14px_40px_rgba(0,0,0,0.55)]",
        variant === "primary"
          ? "text-white shadow-soft bg-gradient-to-r from-accent via-accent2 to-accent3 hover:opacity-[0.96] active:opacity-[0.92]"
          : [
              "border border-white/10 text-text",
              "bg-gradient-to-r from-white/6 via-white/3 to-white/6",
              "hover:border-accent/40 hover:from-accent/10 hover:via-accent2/5 hover:to-accent3/10"
            ].join(" "),
        className
      )}
      {...rest}
    />
  );
}

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return (
    <div
      className={cn(
        // spacing rhythm: consistent padding + calm density
        "rounded-2xl border border-white/10 backdrop-blur p-5 md:p-6 shadow-glow",
        "bg-gradient-to-br from-white/7 via-panel/70 to-black/30",
        "hover:border-white/18 hover:from-white/10 transition-colors",
        className
      )}
      {...rest}
    />
  );
}

export function Badge({
  tone = "neutral",
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "good" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
        tone === "neutral" && "border-white/10 bg-white/5 text-muted",
        tone === "good" && "border-good/30 bg-good/10 text-good",
        tone === "bad" && "border-bad/30 bg-bad/10 text-bad",
        className
      )}
      {...rest}
    />
  );
}

export function Label(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  const { className, ...rest } = props;
  return <label className={cn("text-xs font-medium tracking-wide text-muted", className)} {...rest} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-text appearance-none",
        "bg-black/30 bg-gradient-to-b from-white/[0.06] to-black/[0.35]",
        "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40",
        className
      )}
      {...rest}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-text appearance-none",
        "bg-black/30 bg-gradient-to-b from-white/[0.06] to-black/[0.35]",
        "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/40",
        className
      )}
      {...rest}
    />
  );
}

export function Skeleton(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return <div className={cn("skeleton rounded-xl", className)} {...rest} />;
}


