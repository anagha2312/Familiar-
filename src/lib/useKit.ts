"use client";
import { useEffect, useState } from "react";
import { getKit } from "./store";
import type { Kit } from "./types";

/** Load a kit from this device. `undefined` while loading, `null` if not found. */
export function useKit(id: string) {
  const [kit, setKit] = useState<Kit | null | undefined>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setKit(getKit(id) ?? null);
  }, [id]);
  return [kit, setKit] as const;
}
