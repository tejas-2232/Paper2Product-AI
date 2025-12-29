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
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
        "focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary"
          ? "text-white shadow-soft bg-gradient-to-r from-accent via-accent2 to-accent3 hover:opacity-[0.95] active:opacity-[0.9]"
          : "bg-transparent text-text hover:bg-white/5 border border-border",
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
        "rounded-2xl border border-border bg-panel/70 backdrop-blur px-5 py-4 shadow-glow",
        "hover:border-white/15 transition-colors",
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
  return <label className={cn("text-sm text-muted", className)} {...rest} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm text-text",
        "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40",
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
        "w-full rounded-xl border border-border bg-black/30 px-3 py-2 text-sm text-text",
        "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40",
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


