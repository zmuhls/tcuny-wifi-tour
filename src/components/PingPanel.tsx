import { FormEvent, useEffect, useState } from "react";
import {
  LocateFixed,
  MapPinCheckInside,
  Radio,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { Contributor, PingNetworkInfo, PingRecord, TourPin } from "../types";
import { formatMeters, distanceMeters } from "../utils/geo";
import { getCurrentPosition, measureServerPing, readNetworkInfo } from "../utils/ping";

interface PingPanelProps {
  pin: TourPin;
  contributor: Contributor | null;
  maxGpsAccuracyMeters: number;
  onPing: (
    input: {
      pin: TourPin;
      latitude: number;
      longitude: number;
      gpsAccuracyMeters: number | null;
      serverRoundTripMs: number | null;
      networkInfo: PingNetworkInfo;
    },
  ) => PingRecord;
}

type ProbeStatus = "idle" | "checking" | "passed" | "review" | "failed";

interface LocationProbe {
  status: ProbeStatus;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  message: string;
}

export function PingPanel({
  pin,
  contributor,
  maxGpsAccuracyMeters,
  onPing,
}: PingPanelProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastPing, setLastPing] = useState<PingRecord | null>(null);
  const [locationProbe, setLocationProbe] = useState<LocationProbe>({
    status: "idle",
    distanceMeters: null,
    accuracyMeters: null,
    message: "Not requested",
  });
  const [serverProbe, setServerProbe] = useState<{
    status: ProbeStatus;
    roundTripMs: number | null;
  }>({
    status: "idle",
    roundTripMs: null,
  });

  useEffect(() => {
    setMessage(null);
    setLastPing(null);
    setLocationProbe({
      status: "idle",
      distanceMeters: null,
      accuracyMeters: null,
      message: "Not requested",
    });
    setServerProbe({
      status: "idle",
      roundTripMs: null,
    });
  }, [pin.id]);

  async function requestLocation() {
    setLocationProbe((current) => ({
      ...current,
      status: "checking",
      message: "Requesting",
    }));

    try {
      const position = await getCurrentPosition();
      const distance = distanceMeters(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        {
          latitude: pin.latitude,
          longitude: pin.longitude,
        },
      );
      const accuracy = position.coords.accuracy;
      const insideRadius = distance <= pin.radiusMeters;
      const hasFieldReadyAccuracy = accuracy <= maxGpsAccuracyMeters;
      const status = !insideRadius
        ? "failed"
        : hasFieldReadyAccuracy
          ? "passed"
          : "review";

      setLocationProbe({
        status,
        distanceMeters: distance,
        accuracyMeters: accuracy,
        message: insideRadius ? "Inside radius" : "Outside radius",
      });

      return position;
    } catch (error) {
      const geolocationError = error as Partial<GeolocationPositionError>;
      setLocationProbe({
        status: "failed",
        distanceMeters: null,
        accuracyMeters: null,
        message:
          typeof geolocationError.code === "number"
            ? geolocationErrorMessage(geolocationError)
            : "Unavailable",
      });
      throw error;
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!contributor) {
      setMessage("Join with the event access code before submitting a ping.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setServerProbe({
      status: "checking",
      roundTripMs: null,
    });

    try {
      const [position, serverRoundTripMs] = await Promise.all([
        requestLocation(),
        measureServerPing(),
      ]);
      setServerProbe({
        status: serverRoundTripMs === null ? "review" : "passed",
        roundTripMs: serverRoundTripMs,
      });
      const ping = onPing({
        pin,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        gpsAccuracyMeters: position.coords.accuracy,
        serverRoundTripMs,
        networkInfo: readNetworkInfo(),
      });

      setLastPing(ping);
      setMessage(resultMessage(ping));
    } catch (error) {
      const geolocationError = error as Partial<GeolocationPositionError>;
      setMessage(
        typeof geolocationError.code === "number"
          ? geolocationErrorMessage(geolocationError)
          : "The browser could not collect a location fix for this ping.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ping-panel">
      <div className="ping-panel-header">
        <Radio size={18} />
        <div>
          <p className="eyebrow">Checkoff</p>
          <h2>{pin.shortName}</h2>
        </div>
      </div>

      <ul className="criteria-list signal-check-list">
        <StatusItem
          label="Access code"
          status={contributor ? "passed" : "failed"}
          detail={contributor ? "Joined" : "Join first"}
        />
        <StatusItem
          label="Location"
          status={locationProbe.status}
          detail={locationProbeDetail(
            locationProbe,
            pin.radiusMeters,
            maxGpsAccuracyMeters,
          )}
        />
        <StatusItem
          label="Live ping"
          status={serverProbe.status}
          detail={
            serverProbe.roundTripMs === null
              ? "On submit"
              : `${serverProbe.roundTripMs} ms`
          }
        />
      </ul>

      <form onSubmit={submit}>
        <div className="ping-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => void requestLocation()}
            disabled={busy || locationProbe.status === "checking"}
          >
            <MapPinCheckInside size={16} />
            {locationProbe.status === "checking" ? "Checking..." : "Check location"}
          </button>
          <button
            className="primary-button ping-button"
            type="submit"
            disabled={busy || !contributor}
          >
            <LocateFixed size={18} />
            {busy ? "Checking..." : "Ping from here"}
          </button>
        </div>
      </form>

      {message ? (
        <div
          className={`ping-result ${
            lastPing?.status === "verified" ? "success" : "review"
          }`}
        >
          {lastPing?.status === "verified" ? (
            <ShieldCheck size={18} />
          ) : (
            <TriangleAlert size={18} />
          )}
          <span>{message}</span>
        </div>
      ) : null}

      {lastPing ? (
        <dl className="ping-proof">
          <div>
            <dt>Distance</dt>
            <dd>{formatMeters(lastPing.distanceMeters)}</dd>
          </div>
          <div>
            <dt>Accuracy</dt>
            <dd>
              {lastPing.gpsAccuracyMeters === null
                ? "Unknown"
                : formatMeters(lastPing.gpsAccuracyMeters)}
            </dd>
          </div>
          <div>
            <dt>Server ping</dt>
            <dd>
              {lastPing.serverRoundTripMs === null
                ? "Failed"
                : `${lastPing.serverRoundTripMs} ms`}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

function StatusItem({
  label,
  status,
  detail,
}: {
  label: string;
  status: ProbeStatus;
  detail: string;
}) {
  return (
    <li className={`signal-status signal-${status}`}>
      <span>{label}</span>
      <strong>{detail}</strong>
    </li>
  );
}

function locationProbeDetail(
  probe: LocationProbe,
  radiusMeters: number,
  maxGpsAccuracyMeters: number,
) {
  if (probe.status === "idle") {
    return `Within ${formatMeters(radiusMeters)}`;
  }

  if (probe.status === "checking") {
    return probe.message;
  }

  if (probe.distanceMeters !== null) {
    const accuracy =
      probe.accuracyMeters === null ? "" : ` / ${formatMeters(probe.accuracyMeters)}`;
    const accuracyLabel =
      probe.accuracyMeters !== null && probe.accuracyMeters > maxGpsAccuracyMeters
        ? " accuracy"
        : "";

    return `${formatMeters(probe.distanceMeters)} away${accuracy}${accuracyLabel}`;
  }

  return probe.message;
}

function resultMessage(ping: PingRecord) {
  if (ping.status === "verified") {
    return "Verified. This access point is checked off for the group.";
  }

  if (ping.status === "needs_review") {
    return `Logged for review: ${ping.reasons.join(" ")}`;
  }

  return `Rejected: ${ping.reasons.join(" ")}`;
}

function geolocationErrorMessage(error: Partial<GeolocationPositionError>) {
  if (error.code === 1) {
    return "Location permission was denied. Enable location access to contribute a verified ping.";
  }

  if (error.code === 3) {
    return "The device could not get a GPS fix before the timeout.";
  }

  return "The device reported that position is unavailable.";
}
