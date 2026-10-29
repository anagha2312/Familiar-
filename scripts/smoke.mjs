// Checks both API keys from .env.local with one real request each. Prints status only, never the keys.
// Usage: node scripts/smoke.mjs
import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const base = env.QLOO_API_BASE_URL || "https://hackathon.api.qloo.com";
if (!env.QLOO_API_KEY) console.log("Qloo:   QLOO_API_KEY is empty");
else {
  const res = await fetch(`${base}/search?query=Lydia%20Mendoza&types=urn:entity:artist&take=2`, {
    headers: { "X-Api-Key": env.QLOO_API_KEY },
  });
  const body = await res.json().catch(() => ({}));
  console.log("Qloo:  ", res.status, res.ok ? `ok (${(body.results ?? []).map((r) => r.name).join(", ")})` : JSON.stringify(body).slice(0, 200));
}

if (!env.GEMINI_API_KEY) console.log("Gemini: GEMINI_API_KEY is empty");
else {
  try {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const r = await ai.models.generateContent({ model: env.GEMINI_MODEL || "gemini-3.5-flash", contents: "Reply with the single word OK" });
    console.log("Gemini: ok", JSON.stringify(r.text?.trim()));
  } catch (e) {
    console.log("Gemini: error", String(e.message).slice(0, 160));
  }
}
