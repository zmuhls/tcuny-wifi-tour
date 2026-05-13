import type {
  PingCandidate,
  PingNetworkInfo,
  PingRecord,
  PingStatus,
  PinProgress,
  TourPin,
} from "../types";
import { distanceMeters } from "./geo";

export function normalizeSsid(ssid: string) {
  return ssid.trim().replace(/^["']|["']$/g, "").toLocaleLowerCase();
}

export function ssidMatches(claim: string, expected: string[]) {
  const normalizedClaim = normalizeSsid(claim);

  return expected.some((ssid) => normalizeSsid(ssid) === normalizedClaim);
}

export function verifyPing(candidate: PingCandidate): PingRecord {
  const hasUsableCoordinates =
    Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude);
  const distance = hasUsableCoordinates
    ? distanceMeters(
        {
          latitude: candidate.latitude,
          longitude: candidate.longitude,
        },
        {
          latitude: candidate.pin.latitude,
          longitude: candidate.pin.longitude,
        },
      )
    : Number.POSITIVE_INFINITY;
  const reasons: string[] = [];
  let status: PingStatus = "verified";

  if (candidate.contributor.eventId !== candidate.event.id) {
    reasons.push("Contributor session is not attached to this event.");
    status = "rejected";
  }

  if (
    !candidate.event.accessCodes.includes(
      candidate.contributor.accessCode.trim().toUpperCase(),
    )
  ) {
    reasons.push("Contributor session does not have a valid event access code.");
    status = "rejected";
  }

  if (!hasUsableCoordinates) {
    reasons.push("GPS coordinates were not usable.");
    status = "rejected";
  }

  if (distance > candidate.pin.radiusMeters) {
    reasons.push(
      `GPS is outside the ${candidate.pin.radiusMeters} m site radius.`,
    );
    status = "rejected";
  }

  if (candidate.gpsAccuracyMeters === null) {
    reasons.push("GPS accuracy was not reported by the device.");
    status = downgrade(status);
  } else if (
    !Number.isFinite(candidate.gpsAccuracyMeters) ||
    candidate.gpsAccuracyMeters < 0
  ) {
    reasons.push("GPS accuracy was malformed.");
    status = "rejected";
  } else if (candidate.gpsAccuracyMeters > candidate.event.maxGpsAccuracyMeters) {
    reasons.push(
      `GPS accuracy is ${Math.round(
        candidate.gpsAccuracyMeters,
      )} m, above the ${candidate.event.maxGpsAccuracyMeters} m threshold.`,
    );
    status = downgrade(status);
  }

  if (!candidate.ssidClaim.trim()) {
    reasons.push("Participant did not select an assigned Wi-Fi network.");
    status = "rejected";
  } else if (!ssidMatches(candidate.ssidClaim, candidate.pin.wifi.ssids)) {
    reasons.push(
      `Reported SSID is not assigned to this pin. Expected: ${candidate.pin.wifi.ssids.join(
        " or ",
      )}.`,
    );
    status = "rejected";
  }

  if (!candidate.wifiConnectedClaim) {
    reasons.push("Participant did not confirm they were connected to the assigned Wi-Fi.");
    status = "rejected";
  }

  if (candidate.serverRoundTripMs === null) {
    reasons.push("The app could not confirm a live server ping.");
    status = downgrade(status);
  } else if (
    !Number.isFinite(candidate.serverRoundTripMs) ||
    candidate.serverRoundTripMs < 0
  ) {
    reasons.push("Server ping timing was malformed.");
    status = "rejected";
  }

  if (candidate.pin.wifi.accessType === "needs-recon") {
    reasons.push("This pin is marked needs-recon and requires leader review.");
    status = downgrade(status);
  }

  return {
    id: crypto.randomUUID(),
    eventId: candidate.event.id,
    pinId: candidate.pin.id,
    contributorId: candidate.contributor.id,
    contributorName: candidate.contributor.displayName,
    teamName: candidate.contributor.teamName,
    createdAt: new Date().toISOString(),
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    gpsAccuracyMeters: candidate.gpsAccuracyMeters,
    ssidClaim: candidate.ssidClaim.trim(),
    wifiConnectedClaim: candidate.wifiConnectedClaim,
    serverRoundTripMs: candidate.serverRoundTripMs,
    distanceMeters: distance,
    status,
    reasons: reasons.length
      ? reasons
      : [
          "Access code, geofence, GPS accuracy, SSID claim, and server ping all passed.",
        ],
    networkInfo: candidate.networkInfo,
  };
}

export function summarizePinProgress(
  pin: TourPin,
  pings: PingRecord[],
): PinProgress {
  const pinPings = pings
    .filter((ping) => ping.pinId === pin.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const verified = pinPings.filter((ping) => ping.status === "verified");
  const needsReview = pinPings.filter((ping) => ping.status === "needs_review");
  const teams = Array.from(
    new Set(verified.map((ping) => ping.teamName).filter(Boolean)),
  );

  let status: PinProgress["status"] = "unvisited";
  if (verified.length > 0) {
    status = teams.length > 1 || verified.length > 1 ? "team-verified" : "verified";
  } else if (needsReview.length > 0) {
    status = "needs-review";
  }

  return {
    pinId: pin.id,
    status,
    verifiedCount: verified.length,
    needsReviewCount: needsReview.length,
    teams,
    latestPing: pinPings[0],
  };
}

export function collectNetworkInfo(): PingNetworkInfo {
  const connection = (
    navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };
    }
  ).connection;

  return {
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
    saveData: connection?.saveData,
  };
}

function downgrade(current: PingStatus): PingStatus {
  return current === "rejected" ? "rejected" : "needs_review";
}
