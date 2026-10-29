// Thin, typed client for the Qloo hackathon API. Server-only: the key never reaches the browser.
import "server-only";

const BASE = (process.env.QLOO_API_BASE_URL || "https://hackathon.api.qloo.com").trim().replace(/\/+$/, "");

export type QlooType =
  | "artist"
  | "movie"
  | "tv_show"
  | "place"
  | "book"
  | "brand"
  | "person"
  | "podcast"
  | "destination";

export type AgeBucket =
  | "24_and_younger"
  | "25_to_29"
  | "30_to_34"
  | "35_to_44"
  | "45_to_54"
  | "55_and_older";

export interface QlooEntity {
  id: string;
  name: string;
  type: QlooType;
  subtype?: string;
  year?: number; // release year (films, shows) or career start (artists)
  songs?: string[];
  description?: string;
  image?: string;
  address?: string;
  affinity?: number;
  popularity?: number;
  tags: string[];
  external?: Record<string, string>;
}

export interface QlooTag {
  id: string;
  name: string;
  type?: string;
}

export class QlooError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Private server-side cache (allowed by the hackathon rules). Keeps us well inside quota.
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 1000 * 60 * 60 * 6;

async function get(path: string, params: Record<string, string | number | undefined>) {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new QlooError("QLOO_API_KEY is not set", 500);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${path}?${qs.toString()}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "X-Api-Key": key, accept: "application/json" } });
    if (res.status === 429 || res.status >= 500) {
      lastErr = new QlooError(`Qloo ${res.status} on ${path}`, res.status);
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new QlooError(`Qloo ${res.status} on ${path}: ${body.slice(0, 300)}`, res.status);
    }
    const data = await res.json();
    cache.set(url, { at: Date.now(), data });
    return data;
  }
  throw lastErr;
}

// Tag types that mean something to a caregiver (genre, cuisine, style); skips audience/parking/ops noise.
const SHOWN_TAG = /:(genre|subgenre|cuisine|culinary_style|style|music|keyword:media|ambience)(:|$)/;

/* eslint-disable @typescript-eslint/no-explicit-any */
function shortType(urn: string | undefined): QlooType {
  const t = (urn || "").replace("urn:entity:", "").split(":")[0];
  return (t || "artist") as QlooType;
}

function normalize(raw: any, fallbackType?: QlooType): QlooEntity {
  const p = raw?.properties ?? {};
  const types: string[] = raw?.types ?? (raw?.type ? [raw.type] : []);
  const year =
    Number(p.release_year) ||
    Number(String(p.release_date ?? "").slice(0, 4)) ||
    Number(p.start_year) ||
    undefined;
  const external: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw?.external ?? p.external ?? {})) {
    const first = Array.isArray(v) ? (v as any[])[0] : v;
    if (first?.id) external[k] = String(first.id);
  }
  return {
    id: raw.entity_id ?? raw.id,
    name: raw.name,
    type: fallbackType ?? shortType(raw.subtype ?? types[0]),
    subtype: raw.subtype,
    year: year && year > 1800 ? year : undefined,
    songs: Array.isArray(p.notable_songs) ? p.notable_songs.slice(0, 3) : undefined,
    description: p.short_description || p.description || undefined,
    image: p.image?.url || p.images?.[0]?.url || undefined,
    address: p.address || undefined,
    affinity: typeof raw?.query?.affinity === "number" ? raw.query.affinity : undefined,
    popularity: typeof raw?.popularity === "number" ? raw.popularity : undefined,
    tags: [
      ...new Set<string>(
        (raw?.tags ?? [])
          .filter((t: any) => t?.name && SHOWN_TAG.test(t.type ?? ""))
          .map((t: any) => t.name),
      ),
    ].slice(0, 6),
    external: Object.keys(external).length ? external : undefined,
  };
}

/** Resolve free-text names (an artist, a film, a restaurant) to real Qloo entities. */
export async function searchEntities(query: string, type?: QlooType, take = 5) {
  const data: any = await get("/search", {
    query,
    types: type ? `urn:entity:${type}` : undefined,
    take,
  });
  const results: any[] = data?.results ?? data?.entities ?? [];
  return results.filter((r) => r?.name && (r.entity_id || r.id)).map((r) => normalize(r, type));
}

/** Look up tag IDs (genres, cuisines, keywords) by name. */
export async function searchTags(query: string, parentType?: QlooType, take = 8): Promise<QlooTag[]> {
  const data: any = await get("/v2/tags", {
    "filter.query": query,
    "filter.parents.types": parentType ? `urn:entity:${parentType}` : undefined,
    take,
  });
  const tags: any[] = data?.results?.tags ?? data?.results ?? [];
  return tags
    .filter((t) => t?.id || t?.tag_id)
    .map((t) => ({ id: t.id ?? t.tag_id, name: t.name, type: t.type ?? t.subtype }));
}

export interface InsightsQuery {
  type: QlooType;
  seedEntityIds?: string[];
  seedTagIds?: string[];
  filterTagIds?: string[];
  excludeTagIds?: string[];
  ages?: AgeBucket[];
  locationQuery?: string;
  nearQuery?: string;
  yearMin?: number;
  yearMax?: number;
  releaseCountry?: string;
  excludeIds?: string[];
  take?: number;
}

/** Taste-graph recommendations from /v2/insights. */
export async function insights(q: InsightsQuery) {
  const yearFilterable = q.type === "movie" || q.type === "tv_show";
  const data: any = await get("/v2/insights", {
    "filter.type": `urn:entity:${q.type}`,
    "signal.interests.entities": q.seedEntityIds?.length ? q.seedEntityIds.join(",") : undefined,
    "signal.interests.tags": q.seedTagIds?.length ? q.seedTagIds.join(",") : undefined,
    "filter.tags": q.filterTagIds?.length ? q.filterTagIds.join(",") : undefined,
    "filter.exclude.tags": q.excludeTagIds?.length ? q.excludeTagIds.join(",") : undefined,
    "signal.demographics.age": q.ages?.length ? q.ages.join(",") : undefined,
    "signal.location.query": q.type === "place" ? undefined : q.locationQuery,
    "filter.location.query": q.type === "place" ? q.nearQuery || q.locationQuery : undefined,
    "filter.release_year.min": yearFilterable ? q.yearMin : undefined,
    "filter.release_year.max": yearFilterable ? q.yearMax : undefined,
    "filter.release_country": yearFilterable ? q.releaseCountry : undefined,
    "filter.exclude.entities": q.excludeIds?.length ? q.excludeIds.join(",") : undefined,
    take: Math.min(q.take ?? 12, 50),
  });
  const ents: any[] = data?.results?.entities ?? [];
  return ents.filter((e) => e?.name).map((e) => normalize(e, q.type));
}
