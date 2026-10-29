"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import KitView from "@/components/KitView";
import { useKit } from "@/lib/useKit";

export default function KitPage() {
  const { id } = useParams<{ id: string }>();
  const [kit] = useKit(id);
  if (kit === undefined) return <p className="mx-auto max-w-6xl px-6 py-10 text-muted">Loading…</p>;
  if (kit === null) return <NotFound />;
  return <KitView key={`${kit.id}-${kit.version}`} initial={kit} />;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="font-display text-4xl font-semibold">This kit isn&apos;t on this device</h1>
      <p className="mt-3 text-lg text-muted">Kits are stored privately in the browser that created them. Ask whoever made it for a share link.</p>
      <Link href="/new" className="btn btn-primary mt-6">
        Build a new kit
      </Link>
    </div>
  );
}
