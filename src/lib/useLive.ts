"use client";
import { useEffect, useState } from "react";

let pending: Promise<boolean> | null = null;

/** Whether live research (Qloo) is available. `undefined` while checking. */
export function useLive() {
  const [live, setLive] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    pending ??= fetch("/api/health")
      .then((r) => r.json())
      .then((d) => Boolean(d.live))
      .catch(() => false);
    pending.then(setLive);
  }, []);
  return live;
}
