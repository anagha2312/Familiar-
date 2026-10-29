"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { deleteKit, listKits } from "@/lib/store";
import type { Kit } from "@/lib/types";

export default function KitsPage() {
  const [kits, setKits] = useState<Kit[] | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
  useEffect(() => setKits(listKits()), []);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <h1 className="font-display text-4xl font-semibold">My Memory Kits</h1>
      <p className="mt-2 text-muted">Stored privately on this device.</p>
      {kits && kits.length === 0 && (
        <div className="mt-8 rounded-3xl bg-card border border-line p-8 text-center">
          <p className="text-lg">No kits yet.</p>
          <Link href="/new" className="btn btn-primary mt-4">
            Build the first one
          </Link>
        </div>
      )}
      <ul className="mt-8 space-y-3">
        {kits?.map((k) => {
          const reactions = Object.keys(k.reactions).length;
          return (
            <li key={k.id} className="rounded-3xl bg-card border border-line p-5 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-48">
                <Link href={`/kit/${k.id}`} className="font-display text-2xl font-semibold hover:underline">
                  {k.profile.name}
                </Link>
                <p className="text-muted">
                  Born {k.profile.birthYear} · {k.profile.grewUp} · v{k.version} · {k.items.length} items · {reactions} reactions
                </p>
              </div>
              <Link href={`/kit/${k.id}/session`} className="btn btn-primary !py-2">
                Start session
              </Link>
              <button
                className="btn btn-ghost !py-2"
                onClick={() => {
                  if (confirm(`Delete ${k.profile.name}'s kit from this device?`)) {
                    deleteKit(k.id);
                    setKits(listKits());
                  }
                }}
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
