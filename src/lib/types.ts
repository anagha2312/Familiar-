// Shared between server and client. No server-only imports here.

export interface Profile {
  name: string;
  birthYear: number;
  grewUp: string;
  adultHome?: string;
  heritage?: string;
  languages?: string;
  loves: string;
  avoid?: string;
  diet?: string;
  careCity?: string;
  relation?: string;
}

export type Domain = "music" | "screen" | "table" | "outing";
export type Reaction = "lit" | "calm" | "upset";

export interface KitItem {
  id: string; // Qloo entity id
  domain: Domain;
  name: string;
  kind: string; // artist / movie / tv_show / place
  year?: number;
  image?: string;
  address?: string;
  affinity?: number;
  tags: string[];
  why: string; // why this should feel familiar to them
  prompt: string; // what the caregiver can say or ask
  start?: string; // e.g. a song to start with, or a scene
  alias?: string; // English name when the Qloo name is in another script
  playUrl?: string;
}

export interface Dish {
  name: string;
  story: string;
  textureTip: string;
}

export interface SessionStep {
  minutes: number;
  itemId?: string;
  title: string;
  instruction: string;
}

export interface TrailStep {
  at: number;
  tool: string;
  label: string;
  detail?: string;
  count?: number;
}

export interface Kit {
  id: string;
  version: number;
  createdAt: number;
  profile: Profile;
  portrait: string;
  era: { from: number; to: number };
  items: KitItem[];
  dishes: Dish[];
  starters: string[];
  session: SessionStep[];
  trail: TrailStep[];
  reactions: Record<string, Reaction>;
  changes?: string; // what the agent changed after feedback
  archived?: boolean; // served from the saved showcase because live research is unavailable
}

export type StreamEvent =
  | { type: "step"; step: TrailStep }
  | { type: "thought"; text: string }
  | { type: "kit"; kit: Kit }
  | { type: "error"; message: string; offline?: boolean };
