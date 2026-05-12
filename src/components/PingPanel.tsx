import { FormEvent, useEffect, useState } from "react";
import { Check, LocateFixed, Radio, ShieldCheck, TriangleAlert } from "lucide-react";
import type { Contributor, PingNetworkInfo, PingRecord, TourPin } from "../types";
import { formatMeters } from "../utils/geo";
import { getCurrentPosition, measureServerPing, readNetworkInfo } from "../utils/ping";

interface PingPanelProps {
  pin: TourPin;
  contributor: Contributor | null;
  onPing: (
    input: {
      pin: TourPin;
      latitude: number;
      longitude: number;
      gpsAccuracyMeters: number | null;
      ssidClaim: string;
      serverRoundTripMs: number | null;
      networkInfo: PingNetworkInfo;
    },
  ) => PingRecord;
}

export function PingPanel({ pin, contributor, onPing }: PingPanelProps) {
  const [ssidClaim, setSsidClaim] = useState(pin.wifi.ssids[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastPing, setLastPing] = useState<PingRecord | null>(null);

  useEffect(() => {
    setSsidClaim(pin.wifi.ssids[0] ?? "");
    setMessage(null);
    setLastPing(null);
  }, [pin.id, pin.wifi.ssids]);

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!contributor) {
      setMessage("Join with the event access code before submitting a ping.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const [position, serverRoundTripMs] = await Promise.all([
        getCurrentPosition(),
        measureServerPing(),
      ]);
      const ping = onPing({
        pin,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        gpsAccuracyMeters: position.coords.accuracy,
        ssidClaim,
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

      <ul className="criteria-list">
        <li>Within {formatMeters(pin.radiusMeters)}</li>
        <li>Assigned SSID</li>
        <li>Live ping</li>
      </ul>

      <form onSubmit={submit}>
        <fieldset className="ssid-fieldset">
          <legend>Assigned Wi-Fi</legend>
          <div className="ssid-choice-list">
            {pin.wifi.ssids.map((ssid) => (
              <label
                className={`ssid-choice ${ssidClaim === ssid ? "active" : ""}`}
                key={ssid}
                title={ssid}
              >
                <input
                  className="ssid-choice-input"
                  type="radio"
                  name={`assigned-wifi-${pin.id}`}
                  value={ssid}
                  checked={ssidClaim === ssid}
                  onChange={() => setSsidClaim(ssid)}
                />
                <span className="ssid-choice-check" aria-hidden="true">
                  {ssidClaim === ssid ? <Check size={14} /> : null}
                </span>
                <span className="ssid-choice-name">{ssid}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button className="primary-button ping-button" type="submit" disabled={busy}>
          <LocateFixed size={18} />
          {busy ? "Checking..." : "Ping from here"}
        </button>
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
