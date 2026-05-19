import { describe, expect, it } from "vitest";
import { pins, tourEvent } from "../data/tour";
import type { Contributor, PingCandidate } from "../types";
import { summarizePinProgress, verifyPing } from "./verification";

const contributor: Contributor = {
  id: "test-contributor",
  eventId: tourEvent.id,
  displayName: "Ada",
  teamName: "Team Library",
  accessCode: "TCUNY2026",
  joinedAt: new Date("2026-05-12T10:00:00Z").toISOString(),
};

const pin = pins.find((item) => item.id === "nypl-schwarzman")!;

function candidate(overrides: Partial<PingCandidate> = {}): PingCandidate {
  const targetPin = overrides.pin ?? pin;

  return {
    pin: targetPin,
    event: tourEvent,
    contributor,
    latitude: targetPin.latitude,
    longitude: targetPin.longitude,
    gpsAccuracyMeters: 24,
    serverRoundTripMs: 84,
    ...overrides,
  };
}

describe("verifyPing", () => {
  it("verifies a ping that passes access code, geofence, accuracy, and server ping", () => {
    const ping = verifyPing(candidate());

    expect(ping.status).toBe("verified");
    expect(ping.distanceMeters).toBeLessThan(1);
  });

  it("marks a ping for review when GPS accuracy is weak", () => {
    const ping = verifyPing(candidate({ gpsAccuracyMeters: 140 }));

    expect(ping.status).toBe("needs_review");
    expect(ping.reasons.join(" ")).toContain("GPS accuracy");
  });

  it("rejects stale or forged contributor access codes", () => {
    const forged = verifyPing(
      candidate({
        contributor: {
          ...contributor,
          accessCode: "WALKER-FORGED",
        },
      }),
    );
    const staleEvent = verifyPing(
      candidate({
        contributor: {
          ...contributor,
          eventId: "old-event",
        },
      }),
    );

    expect(forged.status).toBe("rejected");
    expect(forged.reasons.join(" ")).toContain("valid event access code");
    expect(staleEvent.status).toBe("rejected");
    expect(staleEvent.reasons.join(" ")).toContain("not attached to this event");
  });

  it("rejects malformed GPS and timing evidence", () => {
    const malformedGps = verifyPing(candidate({ latitude: Number.NaN }));
    const malformedAccuracy = verifyPing(candidate({ gpsAccuracyMeters: -1 }));
    const malformedPing = verifyPing(candidate({ serverRoundTripMs: -10 }));

    expect(malformedGps.status).toBe("rejected");
    expect(malformedGps.reasons.join(" ")).toContain("GPS coordinates");
    expect(malformedAccuracy.status).toBe("rejected");
    expect(malformedAccuracy.reasons.join(" ")).toContain("GPS accuracy");
    expect(malformedPing.status).toBe("rejected");
    expect(malformedPing.reasons.join(" ")).toContain("Server ping timing");
  });

  it("rejects a ping outside the site geofence", () => {
    const ping = verifyPing(
      candidate({
        latitude: 40.7359999997,
        longitude: -73.9903999999,
      }),
    );

    expect(ping.status).toBe("rejected");
    expect(ping.reasons.join(" ")).toContain("outside");
  });

  it("accepts field-ready indoor GPS when the accuracy circle overlaps the site", () => {
    const gcPin = pins.find((item) => item.id === "cuny-graduate-center")!;
    const ping = verifyPing(
      candidate({
        pin: gcPin,
        latitude: gcPin.latitude + (gcPin.radiusMeters + 35) / 111_320,
        gpsAccuracyMeters: 48,
      }),
    );

    expect(ping.status).toBe("verified");
    expect(ping.reasons.join(" ")).toContain("accuracy circle overlaps");
  });

  it("keeps broad indoor GPS overlap as review rather than hard rejection", () => {
    const gcPin = pins.find((item) => item.id === "cuny-graduate-center")!;
    const ping = verifyPing(
      candidate({
        pin: gcPin,
        latitude: gcPin.latitude + (gcPin.radiusMeters + 120) / 111_320,
        gpsAccuracyMeters: 160,
      }),
    );

    expect(ping.status).toBe("needs_review");
    expect(ping.reasons.join(" ")).toContain("GPS accuracy");
  });

  it("stress verifies every non-recon mapped pin at its own location without Wi-Fi self-report gates", () => {
    const failures = pins
      .filter((item) => item.wifi.accessType !== "needs-recon")
      .map((item) => verifyPing(candidate({ pin: item })))
      .filter((ping) => ping.status !== "verified");

    expect(failures).toEqual([]);
  });

  it("stress rejects out-of-radius pings for every mapped pin", () => {
    const accepted = pins
      .map((item) =>
        verifyPing(
          candidate({
            pin: item,
            latitude:
              item.latitude +
              (item.radiusMeters + tourEvent.maxGpsAccuracyMeters + 20) / 111_320,
          }),
        ),
      )
      .filter((ping) => ping.status !== "rejected");

    expect(accepted).toEqual([]);
  });

  it("stress prevents weak-accuracy pings from checking off any mapped pin", () => {
    const verified = pins
      .map((item) =>
        verifyPing(
          candidate({
            pin: item,
            gpsAccuracyMeters: tourEvent.maxGpsAccuracyMeters + 1,
          }),
        ),
      )
      .filter((ping) => ping.status === "verified");

    expect(verified).toEqual([]);
  });

  it("keeps every mapped pin labeled with at least one Wi-Fi network", () => {
    const missingAssignments = pins.filter(
      (item) =>
        item.wifi.ssids.length === 0 ||
        item.wifi.ssids.some((ssid) => !ssid.trim()),
    );

    expect(missingAssignments).toEqual([]);
  });

  it("captures optional recon Wi-Fi details without making them a checkoff gate", () => {
    const reconPin = pins.find((item) => item.id === "third-space-bushwick-bakery")!;
    const ping = verifyPing(
      candidate({
        pin: reconPin,
        reconWifiReport: {
          networkName: "Bakery Guest",
          accessNote: "Ask at counter.",
        },
      }),
    );

    expect(ping.status).toBe("needs_review");
    expect(ping.reconWifiReport?.networkName).toBe("Bakery Guest");
    expect(ping.reasons.join(" ")).toContain("leader review");
  });

  it("stress handles repeated mixed ping bursts without false checkoffs", () => {
    const attempts = Array.from({ length: 10 }).flatMap(() =>
      pins.flatMap((item) => [
        { kind: "valid", ping: verifyPing(candidate({ pin: item })) },
        {
          kind: "bad-server-timing",
          ping: verifyPing(
            candidate({ pin: item, serverRoundTripMs: -1 }),
          ),
        },
        {
          kind: "out-of-radius",
          ping: verifyPing(
            candidate({
              pin: item,
              latitude:
                item.latitude +
                (item.radiusMeters + tourEvent.maxGpsAccuracyMeters + 20) / 111_320,
            }),
          ),
        },
        {
          kind: "weak-accuracy",
          ping: verifyPing(
            candidate({
              pin: item,
              gpsAccuracyMeters: tourEvent.maxGpsAccuracyMeters + 1,
            }),
          ),
        },
      ]),
    );
    const falseCheckoffs = attempts.filter(
      (attempt) =>
        attempt.kind !== "valid" && attempt.ping.status === "verified",
    );
    const targetProgress = summarizePinProgress(
      pin,
      attempts
        .filter((attempt) => attempt.kind !== "valid")
        .map((attempt) => attempt.ping),
    );

    expect(attempts).toHaveLength(pins.length * 4 * 10);
    expect(falseCheckoffs).toEqual([]);
    expect(targetProgress.status).toBe("needs-review");
    expect(targetProgress.verifiedCount).toBe(0);
  });
});
