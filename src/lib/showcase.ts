// Example kits for the sample people, captured while the live Qloo key works so the app stays
// presentable after the hackathon key is deactivated. Stored privately server-side (Upstash Redis
// on Vercel, a gitignored folder locally): Qloo data must never be committed to the public repo.
import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import { samples } from "./samples";
import type { Kit, Profile } from "./types";

export type ShowcaseSlot = "first" | "learned";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const DIR = path.join(process.cwd(), ".showcase");

const keyFor = (sample: string, slot: ShowcaseSlot) => `familiar:showcase:${sample}:${slot}`;

/** Which sample person this profile is, if it is one of them unchanged. */
export function sampleKeyFor(p: Profile): string | undefined {
  return Object.entries(samples).find(([, s]) =>
    (["name", "birthYear", "grewUp", "loves", "heritage", "careCity", "avoid", "diet"] as const).every(
      (k) => String(s[k] ?? "").trim() === String(p[k] ?? "").trim(),
    ),
  )?.[0];
}

export async function getShowcase(sample: string, slot: ShowcaseSlot = "first"): Promise<Kit | null> {
  try {
    if (redis) return (await redis.get<Kit>(keyFor(sample, slot))) ?? null;
    return JSON.parse(await fs.readFile(path.join(DIR, `${sample}-${slot}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function saveShowcase(sample: string, slot: ShowcaseSlot, kit: Kit) {
  // Only keep kits that are complete enough to show off.
  const domains = new Set(kit.items.map((i) => i.domain));
  if (kit.items.length < 10 || !domains.has("music") || !domains.has("screen")) return;
  try {
    if (redis) await redis.set(keyFor(sample, slot), kit);
    else {
      await fs.mkdir(DIR, { recursive: true });
      await fs.writeFile(path.join(DIR, `${sample}-${slot}.json`), JSON.stringify(kit));
    }
  } catch (err) {
    console.warn("[familiar] could not save showcase kit", err);
  }
}

export async function listShowcase() {
  const out: { key: string; first: Kit | null; learned: Kit | null }[] = [];
  for (const key of Object.keys(samples)) {
    const [first, learned] = await Promise.all([getShowcase(key, "first"), getShowcase(key, "learned")]);
    out.push({ key, first, learned });
  }
  return out;
}
