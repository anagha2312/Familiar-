import { buildKit } from "@/lib/agent";
import { getShowcase, sampleKeyFor, saveShowcase } from "@/lib/showcase";
import { qlooLive } from "@/lib/status";
import type { Kit, Profile, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function validProfile(p: Partial<Profile> | undefined): p is Profile {
  const year = Number(p?.birthYear);
  return Boolean(p?.name?.trim() && p?.grewUp?.trim() && p?.loves?.trim() && year > 1900 && year < new Date().getFullYear());
}

const OFFLINE =
  "Live research has ended: Familiar was built for the Qloo hackathon, and its access to Qloo's taste graph has closed. The example kits it built for Rosa, Walter and Mei while it was live are still here to explore.";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { profile?: Profile; previous?: Kit };
  if (!validProfile(body.profile)) {
    return Response.json({ error: "Please include a name, birth year, hometown and a few things they love." }, { status: 400 });
  }
  const profile: Profile = { ...body.profile, birthYear: Number(body.profile.birthYear) };
  const sample = sampleKeyFor(profile);
  const slot = body.previous ? "learned" : "first";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (e: StreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          open = false; // the browser went away; finish quietly
        }
      };

      // Fall back to the kit captured while live, for the sample people.
      const fromShowcase = async () => {
        const saved = sample ? await getShowcase(sample, slot) : null;
        if (saved) send({ type: "kit", kit: { ...saved, id: body.previous?.id ?? saved.id, archived: true } });
        else send({ type: "error", message: OFFLINE, offline: true });
      };

      try {
        if (!(await qlooLive())) {
          await fromShowcase();
          return;
        }
        const kit = await buildKit({ profile, previous: body.previous }, send);
        if (sample) await saveShowcase(sample, slot, kit);
      } catch (err) {
        console.error(err);
        if (sample && (await getShowcase(sample, slot))) await fromShowcase();
        else send({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
