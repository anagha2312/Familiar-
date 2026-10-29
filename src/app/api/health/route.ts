import { listShowcase } from "@/lib/showcase";
import { qlooLive } from "@/lib/status";

export const runtime = "nodejs";

// Reports whether each part works, without exposing any secret.
export async function GET() {
  const [live, showcase] = await Promise.all([qlooLive(), listShowcase()]);
  return Response.json({
    live,
    gemini: process.env.GEMINI_API_KEY ? "configured" : "missing",
    showcaseStore: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL ? "redis" : "local-file",
    showcase: Object.fromEntries(showcase.map((s) => [s.key, { first: !!s.first, learned: !!s.learned }])),
  });
}
