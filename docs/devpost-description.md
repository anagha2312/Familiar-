# Familiar: a memory-care agent that knows what someone loved

**Live demo:** https://familiar-qloo.vercel.app
**Example kits (open instantly, no waiting):** https://familiar-qloo.vercel.app/examples/rosa · /examples/walter · /examples/mei
**Code:** https://github.com/anagha2312/Familiar- (MIT)

## The problem

57 million people live with dementia, and most are cared for by family members or overstretched care-home staff. One of the best-supported non-drug ways to calm agitation and spark connection is personalised reminiscence: playing the music, showing the films and cooking the food from a person's youth. Memories formed between roughly ages 10 and 30 (the "reminiscence bump") last longest.

The hard part is knowing *what* to play. A Tejana grandmother from San Antonio and a Motown fan from Detroit, both born in the 1940s, share almost nothing culturally. Care homes play one "golden oldies" playlist, and a generic LLM does the same: it guesses from stereotypes about an age group.

## What Familiar does

1. **Life-story intake.** A caregiver spends five minutes on the basics: birth year, where the person grew up, heritage and language, a few things they've always loved, things to avoid, and eating needs.
2. **The agent researches their world in Qloo.** A Gemini agent calls Qloo tools in a loop. It verifies each favourite and era anchor with `/search`, then expands outward with `/v2/insights` using age, era and home-country filters. Every step streams live to the screen.
3. **A Memory Kit:**
   - music, with a specific song to start each artist
   - films and TV
   - home-style dishes adapted for chewing and diet needs
   - familiar restaurants near the care home
   - conversation starters (open-ended, never memory tests)
   - a calm 20-minute session plan

   Every item explains why it should feel familiar to *this* person, and gives the caregiver something to say.
4. **Session Mode.** A large-type, step-by-step guide. The caregiver taps 😊 lit up, 🙂 calm or 😟 upset.
5. **The kit learns.** Items that lit the person up become new Qloo signals. Items that upset them are excluded in code. The agent rebuilds the kit and explains what changed in plain language.
6. **Share** a kit with family and care staff using one link.

## Why it only works with Qloo

Familiar uses Qloo as the agent's research instrument, not as decoration:

- **Grounding:** only entities Qloo returned can appear in a kit. Anything else is dropped in code.
- **Era:**
  - `filter.release_year` for films and TV
  - Qloo's artist `start_year` drops artists whose careers began after the person's youth
  - `signal.demographics.age`
- **Culture:**
  - `filter.release_country` surfaces films and TV from their home country (Mexican Golden Age cinema for Rosa, Hong Kong's *The House of 72 Tenants* for Mei)
  - Native-script search finds 鄧麗君 (Teresa Teng) and 許冠傑 (Sam Hui), whom English searches miss
- **Food:** `place` insights with cuisine tags from `/v2/tags`, near the care home
- **Songs:** each artist's `notable_songs` from Qloo, not invented by the model
- **Feedback loop:** session reactions become `signal.interests.entities` and `filter.exclude.entities`

**What we learned from the data:** Qloo's location signal reflects what people in a city like *today*. It turned a 1950s Detroit childhood into *Yellowstone*. Familiar therefore grounds era through favourites, age and year filters, and uses location only to find restaurants near the care home.

## Same decade, different worlds (real output)

- **Rosa** (b. 1946, Tejana, San Antonio):
  - Music: Pedro Infante "Amorcito Corazón", Lydia Mendoza "Mal Hombre", Lola Beltrán "Cucurrucucú Paloma"
  - Screen: *Nosotros los pobres*, *El Chavo*
  - Food: soft tamales and caldo de pollo for her diabetes
- **Walter** (b. 1941, Detroit, Vietnam veteran):
  - Music: The Temptations "My Girl", Martha Reeves "Dancing in the Street"
  - Screen: *Gunsmoke*, *Bonanza*
  - Food: soul food in Atlanta
  - No war films. A dedicated safety pass even removed "What's Going On" as a starting song.
- **Mei** (b. 1952, Hong Kong → San Francisco):
  - Music: Teresa Teng "The Moon Represents My Heart", Roman Tam "Below the Lion Rock"
  - Screen: *The Carol Burnett Show*
  - Food: dim sum in Chinatown

## Built for real use

- **Safety enforced in code:** avoid-list screening, exclusion of items that upset someone, and a grounding check.
- **Resilient:** Gemini calls time out and fall back across models when one is busy. Gaps in the agent's research are backfilled with deterministic Qloo queries.
- **Private by design:** kits live in the caregiver's browser, and share links carry the kit in the URL fragment.
- **Accessible:** Atkinson Hyperlegible typeface (designed for low vision), large tap targets, dark mode, reduced motion.
- **Stays usable after the hackathon:** example kits are cached privately server-side (Qloo data is never committed). When the hackathon key expires, the app switches to an explanatory offline mode where examples, sessions and share links still work.

## Who it's for, and the business

Families caring at home, and the memory-care facilities and home-care agencies that onboard new aides constantly. A new aide on day one has no idea who "Mrs. Delgado in room 12" was. Familiar hands them her world in one link.

- **B2B:** per-resident pricing for memory care and home-care agencies, with care-plan integration.
- **B2C:** a free tier for families.

## Built with

Next.js 16 · TypeScript · Tailwind CSS · Qloo API (search, tags, insights) · Gemini (function-calling agent) · Upstash Redis · Vercel

*Familiar is a companion for caregivers, not medical advice.*
