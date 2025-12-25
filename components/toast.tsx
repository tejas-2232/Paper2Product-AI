/* eslint-disable react/no-array-index-key */
"use client";

import * as React from "react";
import { cn } from "@/components/ui";

export type ToastTone = "neutral" | "good" | "bad";

export type ToastItem = {
  id: string;
  title?: string;
  message: string;
  tone: ToastTone;
  createdAt: number;
};

type ToastContextValue = {
  push: (t: Omit<ToastItem, "id" | "createdAt"> & { durationMs?: number }) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const timers = React.useRef<Record<string, number>>({});

  const push = React.useCallback(
    (t: Omit<ToastItem, "id" | "createdAt"> & { durationMs?: number }) => {
      const id = makeId();
      const createdAt = Date.now();
      const durationMs = t.durationMs ?? 2600;
      const item: ToastItem = { id, createdAt, title: t.title, message: t.message, tone: t.tone };
      setItems((prev) => [item, ...prev].slice(0, 4));

      if (timers.current[id]) window.clearTimeout(timers.current[id]);
      timers.current[id] = window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
        delete timers.current[id];
      }, durationMs);
    },
    []
  );

  React.useEffect(() => {
    return () => {
      for (const id of Object.keys(timers.current)) window.clearTimeout(timers.current[id]);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-[min(420px,calc(100vw-24px))] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-fadeInUp rounded-2xl border bg-panel/90 backdrop-blur px-4 py-3 shadow-soft",
              t.tone === "neutral" && "border-border",
              t.tone === "good" && "border-good/30",
              t.tone === "bad" && "border-bad/30"
            )}
          >
            {t.title ? <div className="text-sm font-medium text-text">{t.title}</div> : null}
            <div className={cn("text-sm", t.tone === "bad" ? "text-bad" : "text-muted")}>{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider />");
  return ctx;
}


