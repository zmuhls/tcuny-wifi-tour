import { useCallback, useEffect, useMemo, useState } from "react";
import { tourEvent } from "../data/tour";
import type {
  AnecdoteRecord,
  Contributor,
  PingCandidate,
  PingRecord,
  TourPin,
} from "../types";
import { validateAnecdoteBody } from "../utils/anecdotes";
import {
  loadAnecdotes,
  loadContributor,
  loadPings,
  saveAnecdotes,
  saveContributor,
  savePings,
} from "../utils/storage";
import { summarizePinProgress, verifyPing } from "../utils/verification";

const PING_CHANNEL_NAME = "tcuny-wifi-tour:pings";
const ANECDOTE_CHANNEL_NAME = "tcuny-wifi-tour:anecdotes";

export function useTourStore() {
  const [contributor, setContributor] = useState<Contributor | null>(() =>
    loadContributor(),
  );
  const [pings, setPings] = useState<PingRecord[]>(() => loadPings());
  const [anecdotes, setAnecdotes] = useState<AnecdoteRecord[]>(() =>
    loadAnecdotes(),
  );

  useEffect(() => {
    saveContributor(contributor);
  }, [contributor]);

  useEffect(() => {
    savePings(pings);
  }, [pings]);

  useEffect(() => {
    saveAnecdotes(anecdotes);
  }, [anecdotes]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) {
      return;
    }

    const channel = new BroadcastChannel(PING_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<PingRecord[]>) => {
      if (Array.isArray(event.data)) {
        setPings(event.data);
      }
    };

    return () => channel.close();
  }, []);

  useEffect(() => {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(ANECDOTE_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<AnecdoteRecord[]>) => {
        if (Array.isArray(event.data)) {
          setAnecdotes(event.data);
        }
      };

      return () => channel.close();
    }

    return undefined;
  }, []);

  const broadcastPings = useCallback((nextPings: PingRecord[]) => {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(PING_CHANNEL_NAME);
      channel.postMessage(nextPings);
      channel.close();
    }
  }, []);

  const broadcastAnecdotes = useCallback((nextAnecdotes: AnecdoteRecord[]) => {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(ANECDOTE_CHANNEL_NAME);
      channel.postMessage(nextAnecdotes);
      channel.close();
    }
  }, []);

  const join = useCallback(
    (input: { displayName: string; teamName: string; accessCode: string }) => {
      const displayName = input.displayName.trim();
      const normalizedCode = input.accessCode.trim().toUpperCase();

      if (!displayName) {
        return {
          ok: false,
          message: "Add a name before joining the tour.",
        };
      }

      if (!tourEvent.accessCodes.includes(normalizedCode)) {
        return {
          ok: false,
          message: "That access code is not active for this tour.",
        };
      }

      const nextContributor: Contributor = {
        id: crypto.randomUUID(),
        eventId: tourEvent.id,
        displayName,
        teamName: input.teamName.trim() || "Solo walkers",
        accessCode: normalizedCode,
        joinedAt: new Date().toISOString(),
      };

      setContributor(nextContributor);

      return {
        ok: true,
        message: "Joined the tour. You can contribute verified pings.",
      };
    },
    [],
  );

  const leave = useCallback(() => {
    setContributor(null);
  }, []);

  const addPing = useCallback(
    (candidate: Omit<PingCandidate, "event" | "contributor">) => {
      if (!contributor) {
        throw new Error("Join the tour before submitting a ping.");
      }

      const ping = verifyPing({
        ...candidate,
        event: tourEvent,
        contributor,
      });
      const nextPings = [ping, ...pings].slice(0, 400);

      setPings(nextPings);
      broadcastPings(nextPings);

      return ping;
    },
    [broadcastPings, contributor, pings],
  );

  const addAnecdote = useCallback(
    (input: { body: string; accessCode: string }) => {
      const normalizedCode = input.accessCode.trim().toUpperCase();

      if (!tourEvent.accessCodes.includes(normalizedCode)) {
        return {
          ok: false,
          message: "Use the active tour access code to post to the wall.",
        };
      }

      const validation = validateAnecdoteBody(input.body);

      if (!validation.ok) {
        return {
          ok: false,
          message: validation.message,
        };
      }

      const anecdote: AnecdoteRecord = {
        id: crypto.randomUUID(),
        eventId: tourEvent.id,
        contributorId: contributor?.id ?? null,
        contributorName: contributor?.displayName.trim() || "Anonymous participant",
        teamName: contributor?.teamName.trim() || "Bathroom wall",
        accessCode: normalizedCode,
        body: validation.body,
        wordCount: validation.wordCount,
        createdAt: new Date().toISOString(),
      };
      const nextAnecdotes = [anecdote, ...anecdotes].slice(0, 100);

      setAnecdotes(nextAnecdotes);
      broadcastAnecdotes(nextAnecdotes);

      return {
        ok: true,
        message: validation.message,
      };
    },
    [anecdotes, broadcastAnecdotes, contributor],
  );

  const progressByPin = useMemo(() => {
    return new Map<string, ReturnType<typeof summarizePinProgress>>();
  }, []);

  const getProgress = useCallback(
    (pin: TourPin) => summarizePinProgress(pin, pings),
    [pings],
  );

  const resetPings = useCallback(() => {
    setPings([]);
    broadcastPings([]);
  }, [broadcastPings]);

  return {
    event: tourEvent,
    contributor,
    pings,
    anecdotes,
    join,
    leave,
    addPing,
    addAnecdote,
    getProgress,
    progressByPin,
    resetPings,
  };
}
