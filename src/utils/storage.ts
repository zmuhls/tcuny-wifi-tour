import type { AnecdoteRecord, Contributor, PingRecord } from "../types";

const CONTRIBUTOR_KEY = "tcuny-wifi-tour:contributor";
const PINGS_KEY = "tcuny-wifi-tour:pings";
const ANECDOTES_KEY = "tcuny-wifi-tour:anecdotes";

export function loadContributor() {
  return readJson<Contributor | null>(CONTRIBUTOR_KEY, null);
}

export function saveContributor(contributor: Contributor | null) {
  if (!contributor) {
    localStorage.removeItem(CONTRIBUTOR_KEY);
    return;
  }

  localStorage.setItem(CONTRIBUTOR_KEY, JSON.stringify(contributor));
}

export function loadPings() {
  return readJson<PingRecord[]>(PINGS_KEY, []);
}

export function savePings(pings: PingRecord[]) {
  localStorage.setItem(PINGS_KEY, JSON.stringify(pings));
}

export function loadAnecdotes() {
  return readJson<AnecdoteRecord[]>(ANECDOTES_KEY, []);
}

export function saveAnecdotes(anecdotes: AnecdoteRecord[]) {
  localStorage.setItem(ANECDOTES_KEY, JSON.stringify(anecdotes));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
