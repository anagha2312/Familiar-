import Link from "next/link";
import { samples } from "@/lib/samples";

export default function OfflineNotice({ compact }: { compact?: boolean }) {
  return (
    <div className="rounded-3xl border-2 border-gold bg-gold-soft p-5 sm:p-6">
      <p className="font-bold text-gold">Live research has ended</p>
      <p className="mt-1 leading-relaxed">
        Familiar was built for the Qloo LLM Hackathon (October 2026). Its access to Qloo&apos;s taste graph closed with the hackathon, so it can&apos;t research new people
        right now. The kits it built live for three sample people are saved here, including the full research trail and what it learned after a session.
      </p>
      {!compact && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(samples).map(([key, s]) => (
            <Link key={key} href={`/examples/${key}`} className="btn btn-ghost !py-2">
              See {s.name}&apos;s kit →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
