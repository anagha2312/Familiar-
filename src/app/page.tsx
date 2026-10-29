import Link from "next/link";
import { connection } from "next/server";
import OfflineNotice from "@/components/OfflineNotice";
import { samples } from "@/lib/samples";
import { listShowcase } from "@/lib/showcase";
import { qlooLive } from "@/lib/status";

export default async function Home() {
  await connection();
  const [live, showcase] = await Promise.all([qlooLive(), listShowcase()]);
  const ready = new Set(showcase.filter((s) => s.first).map((s) => s.key));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {!live && (
        <div className="pt-4">
          <OfflineNotice />
        </div>
      )}
      <section className="pt-8 sm:pt-16 pb-14 grid lg:grid-cols-[1.15fr_1fr] gap-10 items-center">
        <div className="rise">
          <p className="inline-flex items-center gap-2 rounded-full bg-sage-soft text-sage px-3 py-1 text-sm font-bold">
            For families & memory-care teams
          </p>
          <h1 className="font-display text-[2.6rem] leading-[1.05] sm:text-6xl mt-5 font-semibold tracking-tight">
            Bring them back to the songs they still know by heart.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted max-w-xl leading-relaxed">
            Familiar is an AI agent that builds a personalised <strong className="text-ink">Memory Kit</strong> for someone living with dementia:
            the music, films, food and stories of <em>their</em> youth, from <em>their</em> hometown and culture. It is grounded in Qloo&apos;s
            taste graph of 250M+ cultural entities and learns from every session.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {live && (
              <Link href="/new" className="btn btn-primary text-lg !px-6 !py-3.5">
                Build a Memory Kit
              </Link>
            )}
            <a href="#samples" className={`btn text-lg !px-6 !py-3.5 ${live ? "btn-ghost" : "btn-primary"}`}>
              {ready.size ? "See example kits" : "Try a sample person"}
            </a>
          </div>
        </div>
        <ExampleCard />
      </section>

      <section className="grid sm:grid-cols-3 gap-4 pb-16">
        {[
          ["57M", "people live with dementia worldwide, with ~10M new cases every year (WHO)."],
          ["Ages 10–30", "Memories from these years survive longest. It's called the reminiscence bump."],
          ["Music", "Musical memory is often among the last to fade, and personalised playlists are used to ease agitation."],
        ].map(([big, text]) => (
          <div key={big} className="rounded-3xl bg-card border border-line p-6">
            <p className="font-display text-3xl font-semibold text-accent">{big}</p>
            <p className="mt-2 text-muted leading-relaxed">{text}</p>
          </div>
        ))}
      </section>

      <section className="pb-16">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold">The problem isn&apos;t music. It&apos;s <em>which</em> music.</h2>
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-line p-6 bg-card">
            <p className="text-sm font-bold uppercase tracking-wider text-muted">What a care home usually plays</p>
            <p className="mt-3 text-lg leading-relaxed">
              One &quot;golden oldies&quot; playlist for every resident born in the 1940s. A generic chatbot does the same: it guesses from stereotypes about an age group.
            </p>
          </div>
          <div className="rounded-3xl border-2 border-accent p-6 bg-accent-soft">
            <p className="text-sm font-bold uppercase tracking-wider text-accent">What Familiar does</p>
            <p className="mt-3 text-lg leading-relaxed">
              It crosses <strong>era × hometown × heritage × the things they already love</strong> in Qloo&apos;s taste graph. A Tejana grandmother from
              San Antonio and a Motown fan from Detroit, both born in the 1940s, get completely different kits, and every item is a real, verified entity.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold">How it works</h2>
        <ol className="mt-6 grid md:grid-cols-3 gap-4">
          {[
            ["Tell their story", "Five minutes: birth year, where they grew up, their culture, a few things they've always loved, and anything to avoid."],
            ["The agent researches", "Familiar verifies their favourites in Qloo, finds anchors from their formative years, and expands outward through the taste graph by age, place and affinity."],
            ["Run a session and it learns", "A calm, large-type session guide. Tap how they responded. What lit them up becomes the next signal; what upset them is excluded for good."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-3xl bg-card border border-line p-6">
              <span className="grid place-items-center size-9 rounded-full bg-ink text-paper font-bold">{i + 1}</span>
              <p className="mt-4 font-display text-xl font-semibold">{t}</p>
              <p className="mt-2 text-muted leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="samples" className="pb-10 scroll-mt-6">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold">Three people, three different worlds</h2>
        <p className="mt-2 text-muted text-lg">
          Fictional people born within eleven years of each other.{" "}
          {ready.size ? "See the kits Familiar built for them, with every research step" : "Build their kits live (about a minute each)"}
          {live && ready.size ? ", or run the agent live yourself (about a minute)." : "."}
        </p>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {Object.entries(samples).map(([key, s]) => (
            <div key={key} className="rounded-3xl bg-card border border-line p-6 flex flex-col">
              <p className="font-display text-2xl font-semibold">{s.name}</p>
              <p className="mt-1 text-muted">{s.blurb}</p>
              <div className="mt-5 flex flex-wrap gap-2 mt-auto pt-5">
                {ready.has(key) && (
                  <Link href={`/examples/${key}`} className="btn btn-primary !py-2">
                    See {s.name}&apos;s kit
                  </Link>
                )}
                {live && (
                  <Link href={`/new?sample=${key}`} className={`btn !py-2 ${ready.has(key) ? "btn-ghost" : "btn-primary"}`}>
                    {ready.has(key) ? "Build it live" : `Build ${s.name}'s kit`}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ExampleCard() {
  return (
    <div className="rise rounded-[2rem] bg-card border border-line p-6 sm:p-7 shadow-[0_20px_60px_-30px_rgba(60,30,10,0.35)]" style={{ animationDelay: "0.1s" }}>
      <p className="text-sm font-bold uppercase tracking-wider text-muted">Session · step 3 of 6</p>
      <p className="font-display text-3xl font-semibold mt-3">Play something she danced to</p>
      <p className="mt-3 text-lg leading-relaxed">
        Put on a bolero from the 1960s, hold her hands and sway gently.
      </p>
      <div className="mt-5 rounded-2xl bg-accent-soft p-4">
        <p className="text-sm font-bold text-accent">Say</p>
        <p className="mt-1 text-lg">&quot;Your sisters told me you were the best dancer at every wedding. What did you wear?&quot;</p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm font-bold">
        <span className="rounded-2xl bg-sage-soft text-sage py-3">😊 Lit up</span>
        <span className="rounded-2xl bg-gold-soft text-gold py-3">🙂 Calm</span>
        <span className="rounded-2xl bg-rose-soft text-rose py-3">😟 Upset</span>
      </div>
      <p className="mt-4 text-sm text-muted">Every reaction becomes a signal for the next version of the kit.</p>
    </div>
  );
}
