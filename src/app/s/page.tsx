"use client";
import { useEffect, useState } from "react";
import KitView from "@/components/KitView";
import { readShared } from "@/lib/store";
import type { Kit } from "@/lib/types";

export default function SharedPage() {
  const [kit, setKit] = useState<Kit | null | undefined>(undefined);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the kit lives in the URL hash, only readable after mount
  useEffect(() => setKit(readShared(location.hash)), []);

  if (kit === undefined) return <p className="mx-auto max-w-6xl px-6 py-10 text-muted">Opening shared kit…</p>;
  if (kit === null)
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display text-4xl font-semibold">This link looks incomplete</h1>
        <p className="mt-3 text-lg text-muted">Ask for the share link again. Some messaging apps cut long links short.</p>
      </div>
    );
  return <KitView initial={kit} readOnly />;
}
