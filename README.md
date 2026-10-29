# Familiar

**A memory-care agent that knows what someone loved, and plays it back to them.**

- **Live app:** https://familiar-qloo.vercel.app
- **Demo video:** https://youtu.be/Q_kZys2Y-88
- **Example kits (open instantly):** [Rosa](https://familiar-qloo.vercel.app/examples/rosa) · [Walter](https://familiar-qloo.vercel.app/examples/walter) · [Mei](https://familiar-qloo.vercel.app/examples/mei)

Familiar builds a personalised *Memory Kit* for a person living with dementia: the music, films, food and conversation of their formative years, from their own hometown and culture. Caregivers use it to run calm reminiscence sessions. They tap how the person responded, and the agent re-researches the kit around what works.

It is grounded in [Qloo](https://www.qloo.com)'s cultural taste graph (250M+ entities). Every recommendation is a real entity Qloo returned, never a guess.

## Why this needs a taste graph

Personalised music is one of the most widely used non-drug approaches for people with dementia. Memories from roughly ages 10–30 (the *reminiscence bump*) are the most durable. The hard part is choosing **which** music, films and food. Two women born in 1946, one a Tejana from San Antonio and one a Jewish New Yorker, share almost nothing culturally. A generic LLM falls back to one "oldies" list. Familiar crosses **era × hometown × heritage × known loves** in Qloo:

| Signal | Qloo feature used |
|---|---|
| Things the caregiver says they love | `/search` resolves them to entity IDs, which become `signal.interests.entities` |
| Era anchors the agent proposes | Verified with `/search` before use. Unverified anchors are discarded |
| Their age group | `signal.demographics.age` |
| Formative years | `filter.release_year.min/max` on movies and TV, plus a career-start (`start_year`) filter on artists |
| Films and TV from their home country | `filter.release_country` (e.g. Mexico, Hong Kong) |
| Names in their own language | Native-script `/search` retries (e.g. 鄧麗君 for Teresa Teng) |
| A song to start with | Qloo's `notable_songs` for each artist |
| Comfort food near their care home | `place` insights with `filter.location.query` + cuisine `filter.tags` from `/v2/tags` |
| Things to avoid (war, hospitals…) | `filter.exclude.tags`, plus code-enforced `filter.exclude.entities` for anything that upset them |
| Session feedback | Items that lit them up become the next run's seeds |

## How the agent works

```
caregiver intake ──► Gemini research loop (function calling, ≤8 rounds, parallel calls)
                       ├─ search_entities  → Qloo /search
                       ├─ find_tags        → Qloo /v2/tags
                       └─ recommend        → Qloo /v2/insights (age + location + era + exclusions injected server-side)
                     ──► grounded composition (JSON schema; any id not returned by Qloo is dropped)
                     ──► Memory Kit: soundtrack · on screen · at the table · conversation starters · session plan
session reactions (😊 / 🙂 / 😟) ──► same loop, re-seeded by what worked, excluding what didn't ──► kit v2, v3…
```

- **Streaming trail:** each Qloo call streams to the UI, so caregivers and judges can see *why* each item is there.
- **What we learned from the data:** `signal.location` reflects what people in a place like *today*, which pulled results toward modern hits (*Yellowstone* for a 1950s Detroit kid). Familiar therefore grounds era through seeds, age and year filters, and uses location only for finding restaurants near the care home.
- **Resilient model calls:** Gemini calls time out after 25 s and fall back across models (3.5 Flash → 3.5 Flash-Lite → 3.8 Flash…) on 429, 503 or hangs.
- **Safety in code, not just the prompt:** the age bucket, exclusions for upsetting items and the grounding check are enforced server-side.
- **Backfill:** if the model under-researches a domain, the server runs a deterministic Qloo insights call so the kit is never empty.
- **Privacy:** kits are stored only in the caregiver's browser (localStorage). Share links carry the kit in the URL fragment, which is never sent to a server.

## Features

- Life-story intake with three fictional sample people (Rosa, Walter, Mei) for instant testing
- Memory Kit with Qloo affinity scores, "why it's familiar" and a "Say" prompt on every item
- Diet-aware comfort dishes and familiar restaurants near the care home
- Session Mode: large type, one step at a time, play links, reaction buttons
- Feedback loop: "Update kit from reactions" produces a new version and explains what changed
- One-tap share link for family and care staff
- Accessible by design: Atkinson Hyperlegible typeface, large tap targets, dark mode, reduced-motion support

## Run it locally

Requirements: Node.js 20+, a Qloo hackathon API key, and a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
git clone <this repo>
cd familiar
npm install
cp .env.example .env.local   # then fill in QLOO_API_KEY and GEMINI_API_KEY
node scripts/smoke.mjs       # optional: checks both keys
npm run dev                  # http://localhost:3000
```

| Variable | Default |
|---|---|
| `QLOO_API_KEY` | required |
| `QLOO_API_BASE_URL` | `https://hackathon.api.qloo.com` |
| `GEMINI_API_KEY` | required |
| `GEMINI_MODEL` | `gemini-3.5-flash` |

## Deploy

Deploy on Vercel: import the repo, add the four environment variables, and add the free **Upstash for Redis** integration from the Vercel Marketplace, which stores the example kits. `/api/health` reports whether Qloo is reachable and which examples are saved, without revealing any key.

## After the hackathon

Hackathon Qloo keys are deactivated after judging. Familiar is built to stay explorable afterwards:

- Whenever one of the three sample people (Rosa, Walter, Mei) is built live, the kit is saved as a private server-side example. A "learned" version is also saved after a session update. Following the hackathon rules, Qloo data is never committed to this repository.
- `/examples/rosa`, `/examples/walter` and `/examples/mei` show the saved kits, the full research trail, and the before/after of the learning loop.
- When Qloo is unreachable, the app switches to offline mode automatically. A notice explains what happened, sample builds return the saved kit, and Session Mode, reactions and share links keep working because they never needed Qloo.
- Set `FAMILIAR_FORCE_OFFLINE=1` to preview offline mode locally.

## Code map

- `src/lib/qloo.ts`: typed Qloo client (search, tags, insights) with server-side caching and retries
- `src/lib/agent.ts`: research loop, tools, backfill and grounded composition
- `src/app/api/kit/route.ts`: NDJSON streaming endpoint
- `src/components/KitView.tsx`, `src/app/kit/[id]/session/page.tsx`: kit and session UI

## Disclaimer

Familiar is a companion for caregivers, not a medical device and not medical advice.

## License

[MIT](LICENSE)
Vercel-https://familiar-qloo.vercel.app/