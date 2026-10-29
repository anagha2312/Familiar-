"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ReactionButtons, Thumb } from "@/components/ItemCard";
import { setReaction } from "@/lib/store";
import type { Kit, SessionStep } from "@/lib/types";
import { useKit } from "@/lib/useKit";

function stepsFor(kit: Kit): SessionStep[] {
  if (kit.session.length) return kit.session;
  // Fallback: a simple music-led session.
  return kit.items
    .filter((i) => i.domain === "music")
    .slice(0, 5)
    .map((i) => ({ minutes: 4, itemId: i.id, title: `Listen together: ${i.name}`, instruction: i.why }));
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [kit, setKit] = useKit(id);
  const [i, setI] = useState(0);

  if (kit === undefined) return <p className="mx-auto max-w-3xl px-6 py-10 text-muted">Loading…</p>;
  if (kit === null)
    return (
      <p className="mx-auto max-w-3xl px-6 py-10">
        Kit not found on this device. <Link href="/kits" className="underline">My kits</Link>
      </p>
    );

  const steps = stepsFor(kit);
  const done = i >= steps.length;
  const step = steps[Math.min(i, steps.length - 1)];
  const item = step?.itemId ? kit.items.find((x) => x.id === step.itemId) : undefined;
  const name = kit.profile.name;

  if (done) {
    const sessionItems = steps.map((s) => s.itemId).filter(Boolean) as string[];
    const lit = sessionItems.filter((x) => kit.reactions[x] === "lit").length;
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 text-center rise">
        <p className="text-6xl" aria-hidden>
          🌿
        </p>
        <h1 className="font-display text-4xl font-semibold mt-4">Session complete</h1>
        <p className="mt-3 text-lg text-muted">
          {lit > 0 ? `${name} lit up ${lit} time${lit > 1 ? "s" : ""}. ` : ""}
          Thank you for spending this time together. Your reactions are saved, and Familiar will use them next time you update the kit.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/kit/${kit.id}`} className="btn btn-primary text-lg">
            Back to the kit
          </Link>
          <button className="btn btn-ghost text-lg" onClick={() => setI(0)}>
            Start again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <Link href={`/kit/${kit.id}`} className="text-muted hover:underline">
          ← {name}&apos;s kit
        </Link>
        <p className="text-muted">
          Step {i + 1} of {steps.length} · ~{step.minutes} min
        </p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-line overflow-hidden" aria-hidden>
        <div className="h-full bg-accent transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
      </div>

      <article key={i} className="rise mt-6 rounded-[2rem] bg-card border border-line p-6 sm:p-8">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-tight">{step.title}</h1>
        <p className="mt-4 text-xl sm:text-2xl leading-relaxed">{step.instruction}</p>

        {item && (
          <div className="mt-6 rounded-3xl bg-paper border border-line p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <Thumb item={item} className="size-20 rounded-2xl shrink-0" />
              <div className="min-w-0">
                <p className="font-display text-2xl font-semibold">
                  {item.name}
                  {item.alias && <span className="text-muted text-lg font-normal"> · {item.alias}</span>}
                </p>
                <p className="text-muted">
                  {item.year ? `${item.year} · ` : ""}
                  {item.start ?? item.tags.slice(0, 2).join(", ")}
                </p>
              </div>
            </div>
            {item.playUrl && (
              <a href={item.playUrl} target="_blank" rel="noreferrer" className="btn btn-primary w-full mt-4 text-lg !py-3.5">
                ▶ {item.kind === "place" ? "Open map" : item.kind === "artist" ? "Play" : "Watch"} {item.start ? `“${item.start}”` : item.name}
              </a>
            )}
            <div className="mt-4 rounded-2xl bg-accent-soft px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">Say</p>
              <p className="mt-0.5 text-xl leading-relaxed">“{item.prompt}”</p>
            </div>
            <p className="mt-5 font-bold">How did {name} respond?</p>
            <div className="mt-2">
              <ReactionButtons
                size="lg"
                value={kit.reactions[item.id]}
                onChange={(r) => setKit(setReaction(kit, item.id, r))}
              />
            </div>
          </div>
        )}
      </article>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button className="btn btn-ghost text-lg !py-4" disabled={i === 0} onClick={() => setI((v) => v - 1)}>
          ← Back
        </button>
        <button className="btn btn-primary text-lg !py-4" onClick={() => setI((v) => v + 1)}>
          {i === steps.length - 1 ? "Finish" : "Next →"}
        </button>
      </div>
      <p className="mt-6 text-center text-muted">
        If {name} seems tired or distressed, it&apos;s fine to stop. Calm and connection matter more than finishing.
      </p>
    </div>
  );
}
