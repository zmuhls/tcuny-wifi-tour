import type {
  PingCandidate,
  PingNetworkInfo,
  PingRecord,
  PingStatus,
  PinProgress,
  TourPin,
} from "../types";
import { distanceMeters } from "./geo";

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
  const reportedAccuracyMeters = candidate.gpsAccuracyMeters;
  const validAccuracyMeters =
    reportedAccuracyMeters !== null &&
    Number.isFinite(reportedAccuracyMeters) &&
    reportedAccuracyMeters >= 0
      ? reportedAccuracyMeters
      : null;
  const hasReportedAccuracy = validAccuracyMeters !== null;
  const accuracyOverlapMeters = validAccuracyMeters ?? 0;

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

  if (distance > candidate.pin.radiusMeters + accuracyOverlapMeters) {
    reasons.push(
      `GPS is outside the ${candidate.pin.radiusMeters} m site radius, even after device accuracy is considered.`,
    );
    status = "rejected";
  } else if (distance > candidate.pin.radiusMeters && hasReportedAccuracy) {
    reasons.push(
      `GPS center is ${Math.round(
        distance,
      )} m from the pin, but the ${Math.round(
        reportedAccuracyMeters ?? 0,
      )} m accuracy circle overlaps the site radius.`,
    );
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
    if (candidate.reconWifiReport?.networkName) {
      reasons.push("Reported Wi-Fi details were captured for leader review.");
    }
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
    serverRoundTripMs: candidate.serverRoundTripMs,
    distanceMeters: distance,
    status,
    reasons: reasons.length
      ? reasons
      : [
          "Access code, geofence, GPS accuracy, and server ping all passed.",
        ],
    networkInfo: candidate.networkInfo,
    reconWifiReport: candidate.reconWifiReport,
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
