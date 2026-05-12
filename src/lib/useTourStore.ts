import { useCallback, useEffect, useMemo, useState } from "react";
import { tourEvent } from "../data/tour";
import type { Contributor, PingCandidate, PingRecord, TourPin } from "../types";
import { saveContributor, loadContributor, loadPings, savePings } from "../utils/storage";
import { summarizePinProgress, verifyPing } from "../utils/verification";

const CHANNEL_NAME = "tcuny-wifi-tour:pings";

export function useTourStore() {
  const [contributor, setContributor] = useState<Contributor | null>(() =>
    loadContributor(),
  );
  const [pings, setPings] = useState<PingRecord[]>(() => loadPings());

  useEffect(() => {
    saveContributor(contributor);
  }, [contributor]);

  useEffect(() => {
    savePings(pings);
  }, [pings]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) {
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<PingRecord[]>) => {
      if (Array.isArray(event.data)) {
        setPings(event.data);
      }
    };

    return () => channel.close();
  }, []);

  const broadcast = useCallback((nextPings: PingRecord[]) => {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(nextPings);
      channel.close();
    }
  }, []);

  const join = useCallback(
    (input: { displayName: string; teamName: string; accessCode: string }) => {
      const normalizedCode = input.accessCode.trim().toUpperCase();

      if (!tourEvent.accessCodes.includes(normalizedCode)) {
        return {
          ok: false,
          message: "That access code is not active for this tour.",
        };
      }

      const nextContributor: Contributor = {
        id: crypto.randomUUID(),
        eventId: tourEvent.id,
        displayName: input.displayName.trim(),
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
      broadcast(nextPings);

      return ping;
    },
    [broadcast, contributor, pings],
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
    broadcast([]);
  }, [broadcast]);

  return {
    event: tourEvent,
    contributor,
    pings,
    join,
    leave,
    addPing,
    getProgress,
    progressByPin,
    resetPings,
  };
}
