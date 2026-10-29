import "server-only";
import { GoogleGenAI, ThinkingLevel, Type, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import { insights, searchEntities, searchTags, type AgeBucket, type QlooEntity, type QlooType } from "./qloo";
import type { Domain, Kit, KitItem, Profile, StreamEvent, TrailStep } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
// Tried in order when the preferred model is overloaded, so a busy model never breaks a session.
const FALLBACKS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];

const CALL_TIMEOUT_MS = 25_000;

type GenerateParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

/** generateContent with retries on transient errors and fallback models. Sticks with whichever model last worked. */
function makeGenerate(ai: GoogleGenAI, onSwitch: (model: string) => void) {
  const models = [...new Set([MODEL, ...FALLBACKS])];
  let current = 0;
  return async (params: Omit<GenerateParams, "model">) => {
    let lastErr: unknown;
    for (let m = current; m < models.length; m++) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const t0 = Date.now();
        try {
          const resp = await ai.models.generateContent({
            ...params,
            model: models[m],
            config: { ...params.config, abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS) },
          });
          console.log(`[familiar] ${models[m]} ok in ${Date.now() - t0}ms`);
          if (m !== current) {
            current = m;
            onSwitch(models[m]);
          }
          return resp;
        } catch (err) {
          lastErr = err;
          const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
          const status = timedOut ? 504 : Number((err as { status?: number }).status ?? String(err).match(/"code":\s*(\d{3})/)?.[1]);
          console.warn(`[familiar] ${models[m]} failed (${status || "?"}) after ${Date.now() - t0}ms`);
          if (![429, 500, 503, 504].includes(status) && status !== 404) throw err;
          // A hung or unavailable model won't recover within a request: move straight to the next one.
          if (status === 404 || timedOut) break;
          await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
        }
      }
    }
    throw lastErr;
  };
}
const MAX_ROUNDS = 8;
const LOOP_BUDGET_MS = 110_000;

function ageBucket(birthYear: number): AgeBucket {
  const age = new Date().getFullYear() - birthYear;
  if (age >= 55) return "55_and_older";
  if (age >= 45) return "45_to_54";
  if (age >= 35) return "35_to_44";
  if (age >= 30) return "30_to_34";
  if (age >= 25) return "25_to_29";
  return "24_and_younger";
}

/** The reminiscence bump: memories formed between roughly 10 and 30 are the most durable. */
export function eraFor(birthYear: number) {
  const now = new Date().getFullYear();
  return { from: Math.min(birthYear + 10, now), to: Math.min(birthYear + 30, now) };
}

const tools: FunctionDeclaration[] = [
  {
    name: "search_entities",
    description:
      "Resolve a name (an artist, film, TV show, restaurant or place) to a real entity in Qloo's taste graph. Use it to ground anything the caregiver mentioned, and to verify era-defining anchors before using them as signals.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Name to look up, e.g. 'Pedro Infante' or 'I Love Lucy'" },
        type: { type: Type.STRING, enum: ["artist", "movie", "tv_show", "place", "person", "book"] },
      },
      required: ["query", "type"],
    },
  },
  {
    name: "find_tags",
    description:
      "Find Qloo tag IDs (genres, cuisines, keywords) by name, e.g. 'bolero', 'mexican', 'western', 'dim sum', 'war'. Use with recommend as seeds, filters or exclusions.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING },
        parent_type: { type: Type.STRING, enum: ["artist", "movie", "tv_show", "place"] },
      },
      required: ["query"],
    },
  },
  {
    name: "recommend",
    description:
      "Ask Qloo's taste graph for entities with the highest cultural affinity to the given signals. The person's age group and any items they reacted badly to are applied automatically. For movie/tv_show, use year_min/year_max to stay in their formative years. For place, 'near' is the city where they live now.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ["artist", "movie", "tv_show", "place"] },
        seed_entity_ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Entity IDs from search_entities" },
        seed_tag_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
        filter_tag_ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Only return entities with these tags" },
        exclude_tag_ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Never return entities with these tags" },
        taste_location: {
          type: Type.STRING,
          description:
            "Rarely needed. Biases toward what people in a place like TODAY (not decades ago), so it pulls results modern. Only use when you have no good seeds. Not for places.",
        },
        near: { type: Type.STRING, description: "City to search in (places only)" },
        year_min: { type: Type.INTEGER },
        year_max: { type: Type.INTEGER },
        release_country: {
          type: Type.STRING,
          description: "movie/tv_show only: country of production by English name, e.g. 'Mexico', 'Hong Kong', 'Italy'",
        },
        take: { type: Type.INTEGER },
      },
      required: ["type"],
    },
  },
];

function systemPrompt(p: Profile, era: { from: number; to: number }, feedback: string) {
  return `You are Familiar, a reminiscence-therapy research agent working for a caregiver of someone living with dementia.
Your job is to build a "Memory Kit": music, films/TV, food and places that will feel deeply familiar to THIS person, so the caregiver can use them to calm, connect and spark conversation.

Science you apply:
- The reminiscence bump: memories from ages ~10-30 are the most durable. For ${p.name} that is ${era.from}-${era.to}.
- Music from that window plus music tied to identity (heritage, language, faith, region) reaches people even in late-stage dementia.
- Never use anything on the avoid list. Avoid content tied to trauma (war, loss) unless the caregiver said it's loved.

How to work (use the tools, do not rely on your own memory for recommendations):
1. In ONE round, call search_entities in parallel for every specific thing the caregiver says they love, plus 4-6 era anchors you believe were culturally central to someone of their heritage and hometown in ${era.from}-${era.to} (artists AND specific films/shows). Searching verifies they exist in the taste graph.
   - Search is by NAME of the entity: search singers/bands as artist, films by their exact TITLE as movie (e.g. "Nosotros los pobres", not the actor's name), shows by title as tv_show.
   - The graph often lists non-English artists and films under their native-script name. If an English or romanised search misses (e.g. "Teresa Teng" returns "Vienna Teng"), search again in native script (鄧麗君, 許冠傑, Αλίκη Βουγιουκλάκη…).
   - Each search returns a few candidates. Use ONLY the one id that is truly the thing you meant. A namesake (searching "Lydia Mendoza" also returns "Lydia Lunch"), a remake or a wrong year is NOT a match. Never pass all ids from a search as seeds.
2. Then, in ONE round, call recommend in parallel for ALL of: artist (seeds = 3-6 verified artists); movie AND tv_show (seeds = verified films/shows from their world, year_min=${era.from - 5}, year_max=${era.to}; if they grew up outside the US or in an immigrant community, ALSO make a call with release_country set to their home country, e.g. 'Mexico' or 'Hong Kong', since films and TV from home are often the most familiar)${p.careCity ? `; place near "${p.careCity}" (find_tags with parent_type place for their heritage cuisine, then pass that tag id as filter_tag_ids)` : ""}.
   Artists whose careers began after ${era.to} are dropped automatically.
3. Inspect results. If a list drifted out of era or culture (e.g. generic Hollywood hits for someone who grew up watching Mexican cinema), refine with better seeds, release_country or genre tags and call again. Use find_tags to exclude themes from the avoid list.
4. Stop when you have roughly 10+ strong artists, 8+ films/shows (including TV)${p.careCity ? ", 5+ places" : ""}. Then reply with a short plain-text note on what you found. Do not write the kit yourself.
Be efficient: batch parallel calls, at most ${MAX_ROUNDS} rounds.${feedback}`;
}

function profileText(p: Profile) {
  return [
    `Name: ${p.name}`,
    `Born: ${p.birthYear}`,
    `Grew up in: ${p.grewUp}`,
    p.adultHome && `Adult life in: ${p.adultHome}`,
    p.heritage && `Heritage / community: ${p.heritage}`,
    p.languages && `Languages: ${p.languages}`,
    `Known loves, memories, work and hobbies: ${p.loves}`,
    p.avoid && `AVOID: ${p.avoid}`,
    p.diet && `Eating considerations: ${p.diet}`,
    p.careCity && `Lives now in / care city: ${p.careCity}`,
    p.relation && `Caregiver is their: ${p.relation}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const compact = (e: QlooEntity) => ({
  id: e.id,
  name: e.name,
  type: e.type,
  year: e.year,
  affinity: e.affinity ? Number(e.affinity.toFixed(3)) : undefined,
  tags: e.tags.slice(0, 4),
  songs: e.songs?.slice(0, 2),
  address: e.address,
});

function domainFor(e: QlooEntity, hint?: string): Domain {
  if (e.type === "artist") return "music";
  if (e.type === "movie" || e.type === "tv_show") return "screen";
  if (e.type === "place") return hint === "outing" ? "outing" : "table";
  return (hint as Domain) || "screen";
}

function playUrl(e: QlooEntity, start?: string) {
  if (e.type === "place") {
    return `https://www.google.com/maps/search/${encodeURIComponent(`${e.name} ${e.address ?? ""}`)}`;
  }
  const q = e.type === "artist" ? `${e.name} ${start ?? ""}` : `${e.name} ${e.year ?? ""} ${start ? start : "clip"}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q.trim())}`;
}

export interface BuildInput {
  profile: Profile;
  previous?: Kit;
}

export async function buildKit({ profile, previous }: BuildInput, emit: (e: StreamEvent) => void): Promise<Kit> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });

  const era = eraFor(profile.birthYear);
  const age = ageBucket(profile.birthYear);
  const pool = new Map<string, QlooEntity>(); // kit candidates
  const seen = new Map<string, QlooEntity>(); // every search hit, chosen or not
  const topMatches = new Set<string>();
  const placeTags = new Set<string>();
  const recommended = new Map<QlooType, number>();
  const trail: TrailStep[] = [];
  const step = (s: Omit<TrailStep, "at">) => {
    const full = { ...s, at: Date.now() };
    trail.push(full);
    console.log(`[familiar] ${s.tool}: ${s.label}${s.count != null ? ` (${s.count})` : ""}`);
    emit({ type: "step", step: full });
  };
  const generate = makeGenerate(ai, (model) => step({ tool: "plan", label: "Switched model", detail: `${MODEL} is busy, continuing with ${model}` }));

  const reactions = previous?.reactions ?? {};
  const upset = Object.entries(reactions).filter(([, r]) => r === "upset").map(([id]) => id);
  const lit = Object.entries(reactions).filter(([, r]) => r === "lit").map(([id]) => id);
  const nameOf = (id: string) => previous?.items.find((i) => i.id === id)?.name ?? id;

  let feedback = "";
  if (previous && (lit.length || upset.length)) {
    feedback = `

FEEDBACK FROM REAL SESSIONS (most important signal you have):
- Lit up / sang along / engaged: ${lit.map((id) => `${nameOf(id)} [${id}]`).join(", ") || "none yet"}
- Upset / agitated: ${upset.map((id) => `${nameOf(id)} [${id}]`).join(", ") || "none"}
Use the "lit up" entity IDs directly as seeds (they are already verified, no need to search them). Items that upset them are excluded automatically; also steer away from what they have in common.`;
  }

  // ---- tool implementations -------------------------------------------------
  async function runTool(name: string, args: Record<string, unknown>) {
    if (name === "search_entities") {
      const type = args.type as QlooType;
      const res = await searchEntities(String(args.query), type, 3);
      // Search hits only become kit candidates once the agent chooses one as a seed (namesakes stay out).
      res.forEach((e) => seen.set(e.id, e));
      if (res[0]) topMatches.add(res[0].id);
      step({ tool: "search", label: `Looked up “${args.query}”`, detail: res[0] ? `→ ${res[0].name}${res[0].year ? ` (${res[0].year})` : ""}` : "→ not in graph", count: res.length });
      return { results: res.map(compact) };
    }
    if (name === "find_tags") {
      const res = await searchTags(String(args.query), args.parent_type as QlooType | undefined, 6);
      res.filter((t) => t.id.startsWith("urn:tag:genre:place")).forEach((t) => placeTags.add(t.id));
      step({ tool: "tags", label: `Found tags for “${args.query}”`, detail: res.slice(0, 3).map((t) => t.name).join(", "), count: res.length });
      return { tags: res };
    }
    if (name === "recommend") {
      const type = args.type as QlooType;
      const arr = (k: string) => (Array.isArray(args[k]) ? (args[k] as string[]).filter(Boolean) : undefined);
      const raw = await insights({
        type,
        seedEntityIds: arr("seed_entity_ids"),
        seedTagIds: arr("seed_tag_ids"),
        filterTagIds: arr("filter_tag_ids"),
        excludeTagIds: arr("exclude_tag_ids"),
        ages: type === "place" ? undefined : [age],
        // Location signals reflect present-day audiences, which drags results modern; only on explicit request.
        locationQuery: type === "place" ? undefined : (args.taste_location as string) || undefined,
        nearQuery: type === "place" ? (args.near as string) || profile.careCity : undefined,
        yearMin: args.year_min as number | undefined,
        yearMax: args.year_max as number | undefined,
        releaseCountry: (args.release_country as string) || undefined,
        excludeIds: upset,
        take: type === "artist" ? 30 : Math.min(Number(args.take) || 15, 25),
      });
      // Qloo's artist graph has no release-year filter, so enforce the era with career start year.
      const res = type === "artist" ? raw.filter((e) => !e.year || e.year <= era.to) : raw;
      const dropped = raw.length - res.length;
      res.forEach((e) => pool.set(e.id, e));
      recommended.set(type, (recommended.get(type) ?? 0) + res.length);
      const seedEnts = (arr("seed_entity_ids") ?? []).map((id) => seen.get(id) ?? pool.get(id)).filter((e): e is QlooEntity => !!e);
      // Seeds of the same type as the request are things they love: keep them as kit candidates.
      const screen = (t: QlooType) => t === "movie" || t === "tv_show";
      seedEnts.filter((e) => e.type === type || (screen(e.type) && screen(type))).forEach((e) => pool.set(e.id, e));
      const seeds = seedEnts.map((e) => e.name);
      step({
        tool: "insights",
        label: `Taste graph → ${type.replace("_", " ")}s`,
        detail: [
          seeds.length ? `seeded by ${seeds.slice(0, 3).join(", ")}${seeds.length > 3 ? "…" : ""}` : "",
          args.year_min ? `${args.year_min}–${args.year_max ?? ""}` : "",
          args.release_country ? `made in ${args.release_country}` : "",
          dropped ? `${dropped} dropped as too recent` : "",
          res.slice(0, 3).map((e) => e.name).join(", "),
        ]
          .filter(Boolean)
          .join(" · "),
        count: res.length,
      });
      return { results: res.map(compact) };
    }
    return { error: `Unknown tool ${name}` };
  }

  // Seed the pool with what already worked, so the composer can keep it.
  previous?.items.filter((i) => reactions[i.id] === "lit").forEach((i) =>
    pool.set(i.id, { id: i.id, name: i.name, type: i.kind as QlooType, year: i.year, image: i.image, address: i.address, affinity: i.affinity, tags: i.tags }),
  );

  // ---- research loop ----------------------------------------------------------
  step({ tool: "plan", label: `Formative years: ${era.from}–${era.to}`, detail: `${profile.name}, born ${profile.birthYear}, grew up in ${profile.grewUp}` });

  const contents: Content[] = [{ role: "user", parts: [{ text: `Caregiver's description:\n${profileText(profile)}` }] }];
  const started = Date.now();
  let notes = "";

  for (let round = 0; round < MAX_ROUNDS && Date.now() - started < LOOP_BUDGET_MS; round++) {
    const resp = await generate({
      contents,
      config: { systemInstruction: systemPrompt(profile, era, feedback), tools: [{ functionDeclarations: tools }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    });
    const content = resp.candidates?.[0]?.content;
    const calls = resp.functionCalls ?? [];
    const text = (content?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join(" ").trim();
    if (text) emit({ type: "thought", text: text.slice(0, 400) });
    if (!calls.length) {
      notes = text;
      break;
    }
    if (content) contents.push(content);
    const results: Part[] = await Promise.all(
      calls.map(async (c) => {
        let response: Record<string, unknown>;
        try {
          response = await runTool(c.name ?? "", (c.args ?? {}) as Record<string, unknown>);
        } catch (err) {
          response = { error: err instanceof Error ? err.message : String(err) };
          step({ tool: "error", label: `${c.name} failed`, detail: String(response.error).slice(0, 120) });
        }
        return { functionResponse: { id: c.id, name: c.name, response } };
      }),
    );
    contents.push({ role: "user", parts: results });
  }

  // ---- safety net: make sure each core domain was actually grounded --------------
  const best = [...topMatches].map((id) => seen.get(id)!).filter(Boolean);
  const bestIds = (...types: QlooType[]) => best.filter((e) => types.includes(e.type)).map((e) => e.id).slice(0, 6);
  const backfill: Promise<unknown>[] = [];
  if ((recommended.get("artist") ?? 0) < 5) {
    backfill.push(runTool("recommend", { type: "artist", seed_entity_ids: bestIds("artist") }));
  }
  if ((recommended.get("movie") ?? 0) < 4) {
    backfill.push(runTool("recommend", { type: "movie", seed_entity_ids: bestIds("movie", "tv_show"), year_min: era.from - 5, year_max: era.to }));
  }
  if ((recommended.get("tv_show") ?? 0) < 3) {
    backfill.push(runTool("recommend", { type: "tv_show", seed_entity_ids: bestIds("tv_show", "movie"), year_min: era.from - 5, year_max: era.to }));
  }
  if (profile.careCity && (recommended.get("place") ?? 0) < 3) {
    backfill.push(
      (async () => {
        if (!placeTags.size && profile.heritage) {
          const tags = await searchTags(profile.heritage.split(/[,(]/)[0], "place", 3).catch(() => []);
          tags.filter((t) => t.id.startsWith("urn:tag:genre:place")).forEach((t) => placeTags.add(t.id));
        }
        return runTool("recommend", { type: "place", filter_tag_ids: [...placeTags].slice(0, 2), near: profile.careCity });
      })(),
    );
  }
  if (backfill.length) {
    step({ tool: "plan", label: "Filling gaps", detail: `${backfill.length} more taste-graph queries so every part of the kit is grounded` });
    await Promise.allSettled(backfill);
  }

  if (pool.size === 0) throw new Error("Qloo returned nothing for this profile. Try adding a few specific loves.");

  // ---- compose: write the kit, only from entities that exist in the pool ---------
  step({ tool: "compose", label: "Writing the Memory Kit", detail: `${pool.size} candidates from the taste graph` });
  const kit = await compose(generate, profile, era, [...pool.values()], notes, previous, lit, upset);
  kit.trail = trail;
  emit({ type: "kit", kit });
  return kit;
}

async function compose(
  generate: ReturnType<typeof makeGenerate>,
  profile: Profile,
  era: { from: number; to: number },
  candidates: QlooEntity[],
  notes: string,
  previous: Kit | undefined,
  lit: string[],
  upset: string[],
): Promise<Kit> {
  const byId = new Map(candidates.map((e) => [e.id, e]));
  const list = candidates
    .map(
      (e) =>
        `${e.id} | ${e.type} | ${e.name}${e.year ? ` (${e.type === "artist" ? "active from " : ""}${e.year})` : ""}${e.affinity ? ` | affinity ${e.affinity.toFixed(2)}` : ""}${e.tags.length ? ` | ${e.tags.slice(0, 4).join(", ")}` : ""}${e.songs?.length ? ` | songs: ${e.songs.join(" / ")}` : ""}${e.address ? ` | ${e.address}` : ""}${e.description ? ` | ${e.description.slice(0, 90)}` : ""}`,
    )
    .join("\n");

  const prompt = `Caregiver's description:
${profileText(profile)}

Formative years: ${era.from}-${era.to}.
Research notes: ${notes || "(none)"}
${
  previous
    ? `This is version ${previous.version + 1} of the kit, rebuilt from real session reactions. Keep everything they lit up for (ids: ${lit.join(", ") || "none"}). Already removed because it upset them: ${upset.map((id) => previous.items.find((i) => i.id === id)?.name ?? id).join(", ") || "none"}. In 'changes', write 2-3 plain sentences for the caregiver naming (by NAME, never by id) what upset them and was removed, what lit them up, and which new items were added because of it.`
    : ""
}

CANDIDATES FROM QLOO'S TASTE GRAPH (id | type | name | ...). You may ONLY use these ids:
${list}

Build the Memory Kit:
- items: pick 8 artists (music) and 6 films/TV shows (screen, at least 5 when candidates allow, mixing films and TV)${profile.careCity ? ", up to 4 places to eat (table) and up to 2 outings (outing; parks, gardens, temples, markets, never restaurants)" : ""}. Prefer things from or near ${era.from}-${era.to} and tied to their identity. Skip anything that conflicts with the avoid list or eating needs, or that clearly doesn't fit. Order each domain best-first.
  - why: one warm sentence on why THIS will feel familiar to ${profile.name} specifically (era, hometown, heritage, a loved thing it's connected to). No generic praise.
  - prompt: one thing the caregiver can say or ask while it plays, specific and open-ended, gentle (never quiz memory: no "do you remember...?" tests).
  - start: for artists, one of the songs listed for them in the candidates (or another very well-known song of theirs), preferring joyful, familiar hits. The song or scene must NOT touch anything on the avoid list (e.g. no war or protest songs for someone who must avoid war). Must be a real specific title, never a placeholder like "Classic Hits"; leave empty if unsure; for screen, a famous scene or episode; for places, a dish to order. Leave empty if unsure.
  - alias: ONLY if the candidate's name is in a non-Latin script, its common English or romanised name (e.g. 鄧麗君 → "Teresa Teng"); otherwise empty.
- dishes: 4 home-cooked comfort dishes from their heritage and era; story = one sentence on the memory it may evoke; textureTip = how to adapt it for the eating considerations (or general soft-food tip).
- starters: 8 reminiscence conversation starters drawn from their life story, era and place (open-ended, no testing).
- session: a calm ~20 minute session plan of 5-7 steps, using itemIds from your items where relevant; start soft, build to the most-loved music, end calmly.
- portrait: 2-3 sentences describing the world ${profile.name} grew up in (sounds, screens, kitchen), as context for a new care aide. Warm, specific, no clichés.`;

  const resp = await generate({
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          portrait: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                domain: { type: Type.STRING, enum: ["music", "screen", "table", "outing"] },
                why: { type: Type.STRING },
                prompt: { type: Type.STRING },
                start: { type: Type.STRING },
                alias: { type: Type.STRING },
              },
              required: ["id", "domain", "why", "prompt"],
            },
          },
          dishes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { name: { type: Type.STRING }, story: { type: Type.STRING }, textureTip: { type: Type.STRING } },
              required: ["name", "story", "textureTip"],
            },
          },
          starters: { type: Type.ARRAY, items: { type: Type.STRING } },
          session: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                minutes: { type: Type.INTEGER },
                itemId: { type: Type.STRING },
                title: { type: Type.STRING },
                instruction: { type: Type.STRING },
              },
              required: ["minutes", "title", "instruction"],
            },
          },
          changes: { type: Type.STRING },
        },
        required: ["portrait", "items", "dishes", "starters", "session"],
      },
    },
  });

  const out = JSON.parse(resp.text ?? "{}");
  const seen = new Set<string>();
  const items: KitItem[] = [];
  for (const it of out.items ?? []) {
    const e = byId.get(it.id);
    if (!e || seen.has(e.id) || upset.includes(e.id)) continue; // grounding: drop anything not from Qloo
    seen.add(e.id);
    const start = it.start?.trim() || (e.type === "artist" ? e.songs?.[0] : undefined);
    items.push({
      id: e.id,
      domain: domainFor(e, it.domain),
      name: e.name,
      kind: e.type,
      year: e.year,
      image: e.image,
      address: e.address,
      affinity: e.affinity,
      tags: e.tags.slice(0, 4),
      why: it.why,
      prompt: it.prompt,
      start,
      alias: /[^\u0000-ɏ\s]/.test(e.name) && it.alias?.trim() ? it.alias.trim() : undefined,
      playUrl: playUrl(e, start),
    });
  }

  if (profile.avoid?.trim()) await screenAvoid(generate, profile.avoid, items, (id) => seen.delete(id));

  // Carry over reactions for items that survived. Upset marks are kept even though the item is
  // gone, so it stays excluded in every later version.
  const reactions: Kit["reactions"] = {};
  for (const [id, r] of Object.entries(previous?.reactions ?? {})) if (seen.has(id) || r === "upset") reactions[id] = r;

  return {
    id: previous?.id ?? crypto.randomUUID().slice(0, 8),
    version: (previous?.version ?? 0) + 1,
    createdAt: Date.now(),
    profile,
    portrait: out.portrait ?? "",
    era,
    items,
    dishes: out.dishes ?? [],
    starters: out.starters ?? [],
    session: (out.session ?? []).map((s: { itemId?: string }) => ({ ...s, itemId: s.itemId && seen.has(s.itemId) ? s.itemId : undefined })),
    trail: [],
    reactions,
    changes: previous ? out.changes : undefined,
  };
}

/**
 * A second, narrow model pass that checks every chosen song, scene and item against the avoid list.
 * Composition prompts alone aren't reliable (a fallback model once picked a Vietnam protest song for a
 * veteran who must avoid Vietnam), so this runs on every kit with an avoid list. Mutates `items`.
 */
async function screenAvoid(
  generate: ReturnType<typeof makeGenerate>,
  avoid: string,
  items: KitItem[],
  onDrop: (id: string) => void,
) {
  const list = items.map((i, n) => `${n} | ${i.kind} | ${i.name}${i.start ? ` | start: ${i.start}` : ""}`).join("\n");
  try {
    const resp = await generate({
      contents: `A person living with dementia must AVOID: "${avoid}".
For each line below, decide whether the item itself, or its suggested start song/scene, is about or strongly associated with anything on that avoid list (e.g. a war or protest song, a hospital drama). Be strict about the song/scene, lenient about the artist.
${list}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flagged: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { index: { type: Type.INTEGER }, problem: { type: Type.STRING, enum: ["start", "item"] } },
                required: ["index", "problem"],
              },
            },
          },
          required: ["flagged"],
        },
      },
    });
    const flagged: { index: number; problem: "start" | "item" }[] = JSON.parse(resp.text ?? "{}").flagged ?? [];
    const drop = new Set<number>();
    for (const f of flagged) {
      const it = items[f.index];
      if (!it) continue;
      if (f.problem === "item") drop.add(f.index);
      else {
        // Keep the artist, swap to a safe song: just open the artist without a specific track.
        console.log(`[familiar] avoid-screen: replaced start "${it.start}" for ${it.name}`);
        it.start = undefined;
        it.playUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${it.name} greatest hits`)}`;
      }
    }
    for (const n of [...drop].sort((a, b) => b - a)) {
      console.log(`[familiar] avoid-screen: removed ${items[n].name}`);
      onDrop(items[n].id);
      items.splice(n, 1);
    }
  } catch (err) {
    console.warn("[familiar] avoid-screen skipped", err);
  }
}
