"use client";
// Kits live on the caregiver's device. Nothing about the person leaves it except
// the profile sent to build a kit, and links the caregiver chooses to share.
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Kit, Profile, Reaction, StreamEvent } from "./types";

const KEY = "familiar.kits.v1";

function readAll(): Record<string, Kit> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Kit>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the kit still works for this session */
  }
}

export const listKits = () => Object.values(readAll()).sort((a, b) => b.createdAt - a.createdAt);
export const getKit = (id: string): Kit | undefined => readAll()[id];

export function saveKit(kit: Kit) {
  const all = readAll();
  all[kit.id] = kit;
  writeAll(all);
}

export function deleteKit(id: string) {
  const all = readAll();
  delete all[id];
  writeAll(all);
}

export function setReaction(kit: Kit, itemId: string, reaction: Reaction | null): Kit {
  const reactions = { ...kit.reactions };
  if (reaction) reactions[itemId] = reaction;
  else delete reactions[itemId];
  const next = { ...kit, reactions };
  saveKit(next);
  return next;
}

export function shareUrl(kit: Kit) {
  const slim: Kit = { ...kit, trail: [] };
  return `${location.origin}/s#${compressToEncodedURIComponent(JSON.stringify(slim))}`;
}

export function readShared(hash: string): Kit | null {
  try {
    const json = decompressFromEncodedURIComponent(hash.replace(/^#/, ""));
    return json ? (JSON.parse(json) as Kit) : null;
  } catch {
    return null;
  }
}

/** POST to the agent and stream its progress events back. */
export async function streamKit(body: { profile: Profile; previous?: Kit }, onEvent: (e: StreamEvent) => void) {
  const res = await fetch("/api/kit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
    onEvent({ type: "error", message: err.error ?? "Request failed" });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
  }
  if (buf.trim()) onEvent(JSON.parse(buf));
}
