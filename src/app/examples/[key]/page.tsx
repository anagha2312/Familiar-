import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ExampleView from "./ExampleView";
import { samples } from "@/lib/samples";
import { getShowcase } from "@/lib/showcase";

export default async function ExamplePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const sample = samples[key];
  if (!sample) notFound();
  await connection();
  const [first, learned] = await Promise.all([getShowcase(key, "first"), getShowcase(key, "learned")]);

  if (!first) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display text-4xl font-semibold">{sample.name}&apos;s example isn&apos;t ready yet</h1>
        <p className="mt-3 text-lg text-muted">Build it live and it will be saved here as the example.</p>
        <Link href={`/new?sample=${key}`} className="btn btn-primary mt-6">
          Build {sample.name}&apos;s kit
        </Link>
      </div>
    );
  }
  return <ExampleView first={first} learned={learned} />;
}
