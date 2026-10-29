"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import AgentTrail from "@/components/AgentTrail";
import OfflineNotice from "@/components/OfflineNotice";
import { useLive } from "@/lib/useLive";
import { samples } from "@/lib/samples";
import { saveKit, streamKit } from "@/lib/store";
import type { Profile, TrailStep } from "@/lib/types";

const empty: Profile = { name: "", birthYear: 1945, grewUp: "", loves: "" };

export default function NewKit() {
  const router = useRouter();
  const params = useSearchParams();
  const sample = samples[params.get("sample") ?? ""];
  const [p, setP] = useState<Profile>(() => {
    if (!sample) return empty;
    const profile: Profile & { blurb?: string } = { ...sample };
    delete profile.blurb;
    return profile;
  });
  const [steps, setSteps] = useState<TrailStep[]>([]);
  const [thought, setThought] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const live = useLive();
  const sampleKey = params.get("sample");

  useEffect(() => {
    // Without live research, a sample person goes straight to the kit saved while it was live.
    if (live === false && sampleKey && samples[sampleKey]) router.replace(`/examples/${sampleKey}`);
  }, [live, sampleKey, router]);

  const set =(k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setP((prev) => ({ ...prev, [k]: k === "birthYear" ? Number(e.target.value) : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSteps([]);
    setThought("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    let done = false;
    await streamKit({ profile: p }, (ev) => {
      if (ev.type === "step") setSteps((s) => [...s, ev.step]);
      if (ev.type === "thought") setThought(ev.text);
      if (ev.type === "error") {
        if (ev.offline) setOffline(true);
        else setError(ev.message);
      }
      if (ev.type === "kit") {
        done = true;
        saveKit(ev.kit);
        router.push(`/kit/${ev.kit.id}`);
      }
    }).catch((err) => setError(String(err?.message ?? err)));
    if (!done) setBusy(false);
  }

  if (offline || live === false) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold">Explore what Familiar built</h1>
        <p className="mt-3 text-lg text-muted">
          Familiar builds a Memory Kit by researching a person&apos;s era, hometown, heritage and favourites in Qloo&apos;s cultural taste graph.
        </p>
        <div className="mt-8">
          <OfflineNotice />
        </div>
      </div>
    );
  }

  if (busy) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <p className="text-sm font-bold uppercase tracking-wider text-accent">The agent is working</p>
        <h1 className="font-display text-4xl font-semibold mt-2">Researching {p.name}&apos;s world</h1>
        <p className="mt-3 text-lg text-muted">
          Verifying what {p.name} loves in Qloo&apos;s taste graph, finding anchors from {p.birthYear + 10}–{p.birthYear + 30}, and expanding through cultural affinity. This takes about a minute.
        </p>
        <div className="mt-8">
          <AgentTrail steps={steps} live={!error} thought={thought} />
        </div>
        {error && <ErrorBox message={error} onBack={() => setBusy(false)} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <h1 className="font-display text-4xl sm:text-5xl font-semibold">Tell us about them</h1>
      <p className="mt-3 text-lg text-muted">
        The more specific, the better. A song title, a street, a dish, a TV show is gold. You don&apos;t need to know everything.
      </p>
      {error && <ErrorBox message={error} />}

      <form onSubmit={submit} className="mt-8 space-y-8">
        <Group title="Who they are">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="What they like to be called" required>
              <input className="field" value={p.name} onChange={set("name")} required placeholder="e.g. Rosa, Grandpa Walt" />
            </Field>
            <Field label="Year they were born" required>
              <input className="field" type="number" min={1915} max={1990} value={p.birthYear} onChange={set("birthYear")} required />
            </Field>
            <Field label="You are their…">
              <input className="field" value={p.relation ?? ""} onChange={set("relation")} placeholder="daughter, son, care aide…" />
            </Field>
            <Field label="Languages they speak">
              <input className="field" value={p.languages ?? ""} onChange={set("languages")} placeholder="e.g. Spanish and English" />
            </Field>
          </div>
        </Group>

        <Group title="Where they come from">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Where they grew up" required hint="City, region or country">
              <input className="field" value={p.grewUp} onChange={set("grewUp")} required placeholder="e.g. San Antonio, Texas" />
            </Field>
            <Field label="Where they spent adult life" hint="If different">
              <input className="field" value={p.adultHome ?? ""} onChange={set("adultHome")} placeholder="e.g. San Francisco from 1975" />
            </Field>
          </div>
          <Field label="Heritage, community or faith">
            <input className="field" value={p.heritage ?? ""} onChange={set("heritage")} placeholder="e.g. Mexican-American, Catholic" />
          </Field>
        </Group>

        <Group title="What they love">
          <Field label="Music, films, shows, food, work, hobbies, memories" required hint="Write it the way you'd tell a new care aide">
            <textarea
              className="field min-h-36"
              value={p.loves}
              onChange={set("loves")}
              required
              placeholder="She danced to boleros at every family wedding, loved Pedro Infante films, made tamales every Christmas, worked 30 years as a school cook…"
            />
          </Field>
          <Field label="Anything to avoid" hint="Triggers, sad associations, things they dislike">
            <input className="field" value={p.avoid ?? ""} onChange={set("avoid")} placeholder="e.g. war films, hospitals, loud crowds" />
          </Field>
        </Group>

        <Group title="Care details">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Eating considerations">
              <input className="field" value={p.diet ?? ""} onChange={set("diet")} placeholder="e.g. soft foods, diabetic, low sodium" />
            </Field>
            <Field label="City where they live now" hint="Used to find familiar food nearby">
              <input className="field" value={p.careCity ?? ""} onChange={set("careCity")} placeholder="e.g. Houston, Texas" />
            </Field>
          </div>
        </Group>

        <div className="flex flex-wrap items-center gap-4">
          <button className="btn btn-primary text-lg !px-7 !py-3.5" type="submit">
            Build {p.name ? `${p.name}'s` : "the"} Memory Kit
          </button>
          <p className="text-sm text-muted">Saved only on this device. You choose who to share it with.</p>
        </div>
      </form>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-3xl bg-card/60 border border-line p-5 sm:p-6 space-y-4">
      <legend className="px-2 font-display text-xl font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-bold">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {hint && <span className="block text-sm text-muted">{hint}</span>}
      <span className="block mt-1.5">{children}</span>
    </label>
  );
}

function ErrorBox({ message, onBack }: { message: string; onBack?: () => void }) {
  return (
    <div className="mt-6 rounded-2xl bg-rose-soft text-rose p-4">
      <p className="font-bold">Something went wrong</p>
      <p className="mt-1 break-words">{message}</p>
      {onBack && (
        <button className="btn btn-ghost mt-3 !text-ink" onClick={onBack}>
          Back to the form
        </button>
      )}
    </div>
  );
}
