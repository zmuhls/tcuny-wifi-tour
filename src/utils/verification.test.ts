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
    ssidClaim: targetPin.wifi.ssids[0] ?? "",
    serverRoundTripMs: 84,
    ...overrides,
  };
}

describe("verifyPing", () => {
  it("verifies a ping that passes access code, geofence, accuracy, SSID, and server ping", () => {
    const ping = verifyPing(candidate());

    expect(ping.status).toBe("verified");
    expect(ping.distanceMeters).toBeLessThan(1);
  });

  it("marks a ping for review when GPS accuracy is weak", () => {
    const ping = verifyPing(candidate({ gpsAccuracyMeters: 140 }));

    expect(ping.status).toBe("needs_review");
    expect(ping.reasons.join(" ")).toContain("GPS accuracy");
  });

  it("accepts assigned SSIDs case-insensitively with browser-style quote noise", () => {
    const ping = verifyPing(candidate({ ssidClaim: '"nypl"' }));

    expect(ping.status).toBe("verified");
  });

  it("rejects a ping when the SSID is not assigned to that pin", () => {
    const ping = verifyPing(candidate({ ssidClaim: "CoffeeShopWiFi" }));

    expect(ping.status).toBe("rejected");
    expect(ping.reasons.join(" ")).toContain("not assigned");
  });

  it("rejects a ping when no assigned Wi-Fi is selected", () => {
    const ping = verifyPing(candidate({ ssidClaim: "" }));

    expect(ping.status).toBe("rejected");
    expect(ping.reasons.join(" ")).toContain("assigned Wi-Fi");
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

  it("stress verifies every non-recon mapped pin at its own location with an assigned SSID", () => {
    const failures = pins
      .filter((item) => item.wifi.accessType !== "needs-recon")
      .map((item) => verifyPing(candidate({ pin: item })))
      .filter((ping) => ping.status !== "verified");

    expect(failures).toEqual([]);
  });

  it("stress rejects off-assignment Wi-Fi claims for every mapped pin", () => {
    const accepted = pins
      .map((item) =>
        verifyPing(candidate({ pin: item, ssidClaim: "__wrong_network__" })),
      )
      .filter((ping) => ping.status !== "rejected");

    expect(accepted).toEqual([]);
  });

  it("stress rejects out-of-radius pings for every mapped pin", () => {
    const accepted = pins
      .map((item) =>
        verifyPing(
          candidate({
            pin: item,
            latitude: item.latitude + (item.radiusMeters + 20) / 111_320,
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

  it("keeps every mapped pin pingable through at least one assigned SSID", () => {
    const missingAssignments = pins.filter(
      (item) =>
        item.wifi.ssids.length === 0 ||
        item.wifi.ssids.some((ssid) => !ssid.trim()),
    );

    expect(missingAssignments).toEqual([]);
  });

  it("stress handles repeated mixed ping bursts without false checkoffs", () => {
    const attempts = Array.from({ length: 10 }).flatMap(() =>
      pins.flatMap((item) => [
        { kind: "valid", ping: verifyPing(candidate({ pin: item })) },
        {
          kind: "wrong-ssid",
          ping: verifyPing(
            candidate({ pin: item, ssidClaim: "__wrong_network__" }),
          ),
        },
        {
          kind: "out-of-radius",
          ping: verifyPing(
            candidate({
              pin: item,
              latitude: item.latitude + (item.radiusMeters + 20) / 111_320,
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
