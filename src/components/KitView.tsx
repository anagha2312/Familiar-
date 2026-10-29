"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AgentTrail from "./AgentTrail";
import ItemCard from "./ItemCard";
import { saveKit, setReaction, shareUrl, streamKit } from "@/lib/store";
import { useLive } from "@/lib/useLive";
import type { Domain, Kit, Reaction, TrailStep } from "@/lib/types";

const sections: { domain: Domain; title: string; sub: (k: Kit) => string }[] = [
  { domain: "music", title: "Soundtrack", sub: (k) => `Voices from ${k.era.from}–${k.era.to} and the music of their community` },
  { domain: "screen", title: "On screen", sub: (k) => `Films and shows from the years ${k.profile.name} remembers best` },
  { domain: "table", title: "Familiar food nearby", sub: (k) => `Places in ${k.profile.careCity ?? "their city"} that taste like home` },
  { domain: "outing", title: "Gentle outings", sub: () => "Places that may feel like the old neighbourhood" },
];

export default function KitView({ initial, readOnly, example }: { initial: Kit; readOnly?: boolean; example?: boolean }) {
  const router = useRouter();
  const live = useLive();
  const [kit, setKit] = useState(initial);
  const [updating, setUpdating] = useState(false);
  const [steps, setSteps] = useState<TrailStep[]>([]);
  const [thought, setThought] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showTrail, setShowTrail] = useState(Boolean(example));

  const p = kit.profile;
  const reacted = Object.values(kit.reactions);
  const counts = { lit: reacted.filter((r) => r === "lit").length, upset: reacted.filter((r) => r === "upset").length };

  const react = readOnly ? undefined : (id: string) => (r: Reaction | null) => setKit((k) => setReaction(k, id, r));

  async function update() {
    setUpdating(true);
    setSteps([]);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    let ok = false;
    await streamKit({ profile: kit.profile, previous: kit }, (ev) => {
      if (ev.type === "step") setSteps((s) => [...s, ev.step]);
      if (ev.type === "thought") setThought(ev.text);
      if (ev.type === "error") setError(ev.message);
      if (ev.type === "kit") {
        ok = true;
        saveKit(ev.kit);
        setKit(ev.kit);
      }
    }).catch((e) => setError(String(e?.message ?? e)));
    if (ok) setUpdating(false);
  }

  async function share() {
    const url = shareUrl(kit);
    try {
      if (navigator.share) await navigator.share({ title: `${p.name}'s Memory Kit`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* user cancelled */
    }
  }

  if (updating) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <p className="text-sm font-bold uppercase tracking-wider text-accent">Learning from {reacted.length} reactions</p>
        <h1 className="font-display text-4xl font-semibold mt-2">Updating {p.name}&apos;s kit</h1>
        <p className="mt-3 text-lg text-muted">
          What lit {p.name} up becomes the new signal in the taste graph. What upset them is excluded.
        </p>
        <div className="mt-8">
          <AgentTrail steps={steps} live={!error} thought={thought} />
        </div>
        {error && (
          <div className="mt-6 rounded-2xl bg-rose-soft text-rose p-4">
            <p className="font-bold">Couldn&apos;t update the kit</p>
            <p className="mt-1">{error}</p>
            <button className="btn btn-ghost mt-3 !text-ink" onClick={() => setUpdating(false)}>
              Back to the kit
            </button>
          </div>
        )}
      </div>
    );
  }

  const tableItems = kit.items.filter((i) => i.domain === "table");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
      {/* Header */}
      <section className="rise grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <div>
          <p className="flex flex-wrap gap-2 text-sm font-bold">
            <span className="rounded-full bg-accent-soft text-accent px-3 py-1">
              Formative years {kit.era.from}–{kit.era.to}
            </span>
            <span className="rounded-full bg-sage-soft text-sage px-3 py-1">
              {kit.items.length} items verified in Qloo
            </span>
            {kit.version > 1 && <span className="rounded-full bg-gold-soft text-gold px-3 py-1">Version {kit.version}</span>}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold mt-4">{p.name}&apos;s Memory Kit</h1>
          <p className="mt-2 text-muted">
            Born {p.birthYear} · grew up in {p.grewUp}
            {p.heritage ? ` · ${p.heritage}` : ""}
          </p>
          <p className="mt-5 text-lg leading-relaxed max-w-2xl">{kit.portrait}</p>
        </div>

        <aside className="rounded-3xl bg-card border border-line p-5 space-y-3">
          {readOnly ? (
            <>
              <p className="font-bold">{example ? "Try a session with it" : "Shared with you"}</p>
              <p className="text-muted">
                {example
                  ? `Copy this example to your device to step through the 20-minute session and tap how ${p.name} responds. It works even without live research.`
                  : `Save it to this device to run sessions and record how ${p.name} responds.`}
              </p>
              <button
                className="btn btn-primary w-full"
                onClick={() => {
                  // Examples get their own id so trying one never collides with the saved original.
                  const copy = example ? { ...kit, id: `${kit.id}-${crypto.randomUUID().slice(0, 4)}`, reactions: {} } : kit;
                  saveKit(copy);
                  router.push(example ? `/kit/${copy.id}/session` : `/kit/${copy.id}`);
                }}
              >
                {example ? "▶ Try the session" : "Save to this device"}
              </button>
            </>
          ) : (
            <>
              <Link href={`/kit/${kit.id}/session`} className="btn btn-primary w-full text-lg !py-3.5">
                ▶ Start a 20-minute session
              </Link>
              <button className="btn btn-ghost w-full" onClick={share}>
                {copied ? "Link copied ✓" : "Share with family & care staff"}
              </button>
              <div className="rounded-2xl bg-paper p-4">
                <p className="font-bold">The kit learns</p>
                <p className="text-sm text-muted mt-1">
                  {reacted.length === 0
                    ? `Tap 😊 / 🙂 / 😟 on items as you use them. Familiar then re-runs the taste graph around what works for ${p.name}.`
                    : `${counts.lit} lit up · ${counts.upset} upset · ${reacted.length} total reactions recorded.`}
                </p>
                <button className="btn btn-ghost w-full mt-3 !py-2" disabled={reacted.length === 0 || live === false} onClick={update}>
                  ↻ Update kit from reactions
                </button>
                {live === false && (
                  <p className="text-sm text-muted mt-2">Updating needs live research, which ended with the hackathon. Reactions are still saved.</p>
                )}
              </div>
            </>
          )}
        </aside>
      </section>

      {kit.archived && (
        <section className="mt-6 rounded-3xl border-2 border-gold bg-gold-soft p-5">
          <p className="font-bold text-gold">Saved example</p>
          <p className="mt-1 leading-relaxed">
            Live research has ended with the Qloo hackathon, so this is the kit Familiar built for {p.name} on{" "}
            {new Date(kit.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} while it was live. Sessions and
            reactions still work.
          </p>
        </section>
      )}

      {kit.changes && (
        <section className="mt-6 rounded-3xl border-2 border-sage bg-sage-soft p-5">
          <p className="font-bold text-sage">What changed in version {kit.version}</p>
          <p className="mt-1 leading-relaxed">{kit.changes}</p>
        </section>
      )}

      {/* Sections */}
      {sections.map((s) => {
        const items = kit.items.filter((i) => i.domain === s.domain);
        if (s.domain === "table") return <TableSection key="table" kit={kit} items={tableItems} react={react} sub={s.sub(kit)} />;
        if (!items.length) return null;
        return (
          <section key={s.domain} className="mt-12">
            <SectionHead title={s.title} sub={s.sub(kit)} />
            <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((it) => (
                <ItemCard key={it.id} item={it} reaction={kit.reactions[it.id]} onReact={react?.(it.id)} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="mt-12 grid lg:grid-cols-2 gap-6">
        <div>
          <SectionHead title="Conversation starters" sub="Open-ended invitations, never memory tests" />
          <ul className="mt-5 space-y-2">
            {kit.starters.map((s, i) => (
              <li key={i} className="rounded-2xl bg-card border border-line px-4 py-3 text-lg leading-relaxed">
                “{s}”
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionHead title="Session plan" sub="About 20 minutes, calm start, calm finish" />
          <ol className="mt-5 space-y-2">
            {kit.session.map((st, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-card border border-line px-4 py-3">
                <span className="grid place-items-center size-8 shrink-0 rounded-full bg-ink text-paper font-bold text-sm">{i + 1}</span>
                <div>
                  <p className="font-bold">
                    {st.title} <span className="font-normal text-muted text-sm">· {st.minutes} min</span>
                  </p>
                  <p className="text-muted leading-relaxed">{st.instruction}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {kit.trail.length > 0 && (
        <section className="mt-12">
          <button className="font-display text-2xl font-semibold flex items-center gap-2" onClick={() => setShowTrail((v) => !v)} aria-expanded={showTrail}>
            <span className={`transition-transform ${showTrail ? "rotate-90" : ""}`}>›</span> How the agent built this kit
          </button>
          <p className="text-muted mt-1">
            {kit.trail.filter((t) => ["search", "insights", "tags"].includes(t.tool)).length} calls to Qloo&apos;s taste graph. Every item above is a real entity it returned.
          </p>
          {showTrail && (
            <div className="mt-4">
              <AgentTrail steps={kit.trail} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="font-display text-3xl font-semibold">{title}</h2>
      <p className="text-muted mt-1">{sub}</p>
    </div>
  );
}

function TableSection({
  kit,
  items,
  react,
  sub,
}: {
  kit: Kit;
  items: Kit["items"];
  react?: (id: string) => (r: Reaction | null) => void;
  sub: string;
}) {
  if (!kit.dishes.length && !items.length) return null;
  return (
    <section className="mt-12">
      <SectionHead title="At the table" sub={`Food is memory too. ${kit.profile.diet ? `Adapted for: ${kit.profile.diet}.` : ""}`} />
      {kit.dishes.length > 0 && (
        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          {kit.dishes.map((d) => (
            <article key={d.name} className="rounded-3xl bg-card border border-line p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Cook together, or just the smell</p>
              <h3 className="font-display text-xl font-semibold mt-1">{d.name}</h3>
              <p className="mt-2 leading-relaxed">{d.story}</p>
              <p className="mt-3 rounded-2xl bg-sage-soft text-ink px-4 py-2 text-[15px]">
                <strong className="text-sage">Texture tip:</strong> {d.textureTip}
              </p>
            </article>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <>
          <p className="mt-8 font-bold text-lg">{sub}</p>
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it) => (
              <ItemCard key={it.id} item={it} reaction={kit.reactions[it.id]} onReact={react?.(it.id)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
