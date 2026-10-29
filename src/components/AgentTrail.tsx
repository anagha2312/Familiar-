"use client";
import type { TrailStep } from "@/lib/types";

const icon: Record<string, string> = {
  plan: "🗓️",
  search: "🔎",
  tags: "🏷️",
  insights: "🕸️",
  compose: "✍️",
  error: "⚠️",
};

const toolLabel: Record<string, string> = {
  search: "Qloo search",
  tags: "Qloo tags",
  insights: "Qloo insights",
  compose: "Gemini",
  plan: "Agent",
  error: "Retry",
};

export default function AgentTrail({ steps, live, thought }: { steps: TrailStep[]; live?: boolean; thought?: string }) {
  return (
    <div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="rise flex gap-3 rounded-2xl bg-card border border-line px-4 py-3">
            <span className="text-xl leading-7" aria-hidden>
              {icon[s.tool] ?? "•"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-bold">{s.label}</span>
                {typeof s.count === "number" && <span className="text-sm text-muted">{s.count} results</span>}
                <span className="ml-auto text-[11px] uppercase tracking-wider text-muted">{toolLabel[s.tool] ?? s.tool}</span>
              </div>
              {s.detail && <p className="text-[15px] text-muted break-words">{s.detail}</p>}
            </div>
          </li>
        ))}
        {live && (
          <li className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-muted">
            <span className="flex gap-1" aria-hidden>
              <span className="pulse-dot size-2 rounded-full bg-accent" />
              <span className="pulse-dot size-2 rounded-full bg-accent" style={{ animationDelay: "0.2s" }} />
              <span className="pulse-dot size-2 rounded-full bg-accent" style={{ animationDelay: "0.4s" }} />
            </span>
            <span className="text-[15px]">{thought || "Thinking about their world…"}</span>
          </li>
        )}
      </ol>
    </div>
  );
}
