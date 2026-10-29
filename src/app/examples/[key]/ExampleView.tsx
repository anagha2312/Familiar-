"use client";
import { useState } from "react";
import KitView from "@/components/KitView";
import type { Kit } from "@/lib/types";

const date = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function ExampleView({ first, learned }: { first: Kit; learned: Kit | null }) {
  const [tab, setTab] = useState<"first" | "learned">("first");
  const kit = tab === "learned" && learned ? learned : first;
  const name = first.profile.name;

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-2">
        <div className="rounded-3xl bg-card border border-line p-5 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-bold uppercase tracking-wider text-accent">Example · built live by the agent</p>
            <p className="mt-1 leading-relaxed">
              Familiar researched {name} on {date(first.createdAt)}, calling Qloo&apos;s taste graph{" "}
              {first.trail.filter((t) => ["search", "insights", "tags"].includes(t.tool)).length} times. Every item is a real Qloo entity. Scroll to the bottom to see each step.
            </p>
          </div>
          {learned && (
            <div className="flex rounded-full border border-line bg-paper p-1 text-[15px] font-bold shrink-0" role="tablist">
              {(
                [
                  ["first", "1 · First build"],
                  ["learned", "2 · After a session"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded-full px-4 py-2 transition-colors ${tab === t ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {tab === "learned" && learned && (
          <p className="mt-3 text-muted">
            A caregiver ran a session with version 1 and tapped how {name} responded. Familiar fed what lit {name} up back into Qloo as new signals and
            excluded what upset them.
          </p>
        )}
      </div>
      <KitView key={tab} initial={kit} readOnly example />
    </div>
  );
}
