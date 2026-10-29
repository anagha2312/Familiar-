"use client";
import { useState } from "react";
import type { KitItem, Reaction } from "@/lib/types";

const kindLabel: Record<string, string> = { artist: "Artist", movie: "Film", tv_show: "TV", place: "Place" };

export function ReactionButtons({
  value,
  onChange,
  size = "sm",
}: {
  value?: Reaction;
  onChange?: (r: Reaction | null) => void;
  size?: "sm" | "lg";
}) {
  const opts: { r: Reaction; emoji: string; label: string; on: string }[] = [
    { r: "lit", emoji: "😊", label: "Lit up", on: "bg-sage text-paper border-sage" },
    { r: "calm", emoji: "🙂", label: "Calm", on: "bg-gold text-paper border-gold" },
    { r: "upset", emoji: "😟", label: "Upset", on: "bg-rose text-paper border-rose" },
  ];
  const big = size === "lg";
  return (
    <div className={`grid grid-cols-3 gap-2 ${big ? "text-lg" : "text-sm"}`} role="group" aria-label="How did they respond?">
      {opts.map((o) => {
        const active = value === o.r;
        return (
          <button
            key={o.r}
            type="button"
            disabled={!onChange}
            aria-pressed={active}
            onClick={() => onChange?.(active ? null : o.r)}
            className={`rounded-2xl border-2 font-bold transition-colors ${big ? "py-4" : "py-2"} ${active ? o.on : "border-line bg-card hover:border-muted"} disabled:cursor-default`}
          >
            <span aria-hidden>{o.emoji}</span> {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Thumb({ item, className = "" }: { item: KitItem; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (item.image && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.image} alt="" className={`object-cover bg-line ${className}`} loading="lazy" onError={() => setBroken(true)} />;
  }
  const hue = [...item.name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className={`grid place-items-center font-display font-semibold text-white ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 45%), hsl(${(hue + 40) % 360} 50% 35%))` }}
      aria-hidden
    >
      <span className="text-3xl">{item.name.slice(0, 1)}</span>
    </div>
  );
}

export default function ItemCard({
  item,
  reaction,
  onReact,
}: {
  item: KitItem;
  reaction?: Reaction;
  onReact?: (r: Reaction | null) => void;
}) {
  const playVerb = item.kind === "place" ? "Open map" : item.kind === "artist" ? "Play" : "Watch";
  return (
    <article className={`rounded-3xl bg-card border p-4 sm:p-5 flex flex-col gap-4 ${reaction === "upset" ? "border-rose opacity-70" : reaction === "lit" ? "border-sage" : "border-line"}`}>
      <div className="flex gap-4">
        <Thumb item={item} className="size-20 sm:size-24 rounded-2xl shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            {kindLabel[item.kind] ?? item.kind}
            {item.year ? (item.kind === "artist" ? ` · active from ${item.year}` : ` · ${item.year}`) : ""}
          </p>
          <h3 className="font-display text-xl font-semibold leading-tight mt-0.5">{item.name}</h3>
          {item.alias && <p className="text-muted text-sm">{item.alias}</p>}
          {item.tags.length > 0 && (
            <p className="mt-1.5 flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((t) => (
                <span key={t} className="rounded-full bg-paper border border-line px-2 py-0.5 text-xs text-muted">
                  {t}
                </span>
              ))}
            </p>
          )}
          {typeof item.affinity === "number" && <Affinity value={item.affinity} />}
        </div>
      </div>

      <p className="leading-relaxed">{item.why}</p>

      <div className="rounded-2xl bg-accent-soft px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">Say</p>
        <p className="mt-0.5 leading-relaxed">“{item.prompt}”</p>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {item.playUrl && (
          <a href={item.playUrl} target="_blank" rel="noreferrer" className="btn btn-ghost !py-2 !px-4 text-[15px]">
            ▶ {playVerb}
            {item.start ? <span className="text-muted font-normal truncate max-w-48">: {item.start}</span> : null}
          </a>
        )}
      </div>
      {onReact && <ReactionButtons value={reaction} onChange={onReact} />}
    </article>
  );
}

function Affinity({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="mt-2 flex items-center gap-2" title="How strongly Qloo's taste graph links this to their signals">
      <span className="h-1.5 w-20 rounded-full bg-line overflow-hidden">
        <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-xs text-muted">Qloo affinity {pct}%</span>
    </div>
  );
}
