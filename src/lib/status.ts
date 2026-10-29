import "server-only";
import { searchEntities } from "./qloo";

// Whether live research is possible. Cached so page views don't spend Qloo quota.
let cached: { at: number; live: boolean } | null = null;

export async function qlooLive(): Promise<boolean> {
  if (process.env.FAMILIAR_FORCE_OFFLINE === "1") return false;
  if (cached && Date.now() - cached.at < (cached.live ? 10 : 2) * 60_000) return cached.live;
  const live = await searchEntities("Aretha Franklin", "artist", 1)
    .then((r) => r.length > 0)
    .catch(() => false);
  cached = { at: Date.now(), live };
  return live;
}
