import {
  CheckCircle2,
  CircleDot,
  ExternalLink,
  MapPinned,
  Radio,
  TriangleAlert,
} from "lucide-react";
import type { PinProgress, TourPathway, TourPin } from "../types";
import { formatMeters } from "../utils/geo";

interface PinCardProps {
  pin: TourPin;
  progress: PinProgress;
  selected?: boolean;
  compact?: boolean;
  onSelect?: (pinId: string) => void;
  onOverview?: (pinId: string) => void;
}

export function PinCard({
  pin,
  progress,
  selected,
  compact,
  onSelect,
  onOverview,
}: PinCardProps) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    pin.mapsQuery,
  )}`;
  const sourceUrl = pin.sourceLinks[0]?.url;
  const pathwayText = pin.pathways?.map(pathwayLabel).join(" / ") ?? "Primary route";

  return (
    <article className={`pin-card ${selected ? "selected" : ""}`}>
      <button
        className="pin-card-main"
        type="button"
        onClick={() => onSelect?.(pin.id)}
        onDoubleClick={(event) => {
          event.preventDefault();
          onOverview?.(pin.id);
        }}
      >
        <span className={`category-dot dot-${pin.category}`} />
        <span>
          <strong>{compact ? pin.shortName : pin.name}</strong>
          {!compact ? <small>{pin.address}</small> : null}
        </span>
      </button>

      <div className="pin-card-meta">
        <span className={`status-pill status-${progress.status}`}>
          {statusIcon(progress.status)}
          {progress.status.replace("-", " ")}
        </span>
        {pin.role !== "optional" ? (
          <span className={`role-pill role-${pin.role}`}>{pin.role}</span>
        ) : null}
        <span>{formatMeters(pin.radiusMeters)} radius</span>
      </div>

      {!compact ? (
        <>
          <dl className="wifi-details">
            <div>
              <dt>Provider</dt>
              <dd>{pin.wifi.provider}</dd>
            </div>
            <div>
              <dt>SSID</dt>
              <dd>{pin.wifi.ssids.join(" / ")}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {pin.wifi.statusLabel}
                {pin.wifi.statusDate ? (
                  <span className="detail-note">Updated {pin.wifi.statusDate}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{pin.wifi.locationType}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{accessLabel(pin.wifi.accessType)}</dd>
            </div>
            <div>
              <dt>Source ID</dt>
              <dd>{pin.wifi.sourceId ?? "Manual record"}</dd>
            </div>
            <div>
              <dt>Pathway</dt>
              <dd>{pathwayText}</dd>
            </div>
            <div>
              <dt>Live</dt>
              <dd>{liveStatusLabel(pin.wifi.liveStatus)}</dd>
            </div>
            {pin.wifi.remarks ? (
              <div className="wide-detail">
                <dt>Notes</dt>
                <dd>{pin.wifi.remarks}</dd>
              </div>
            ) : null}
          </dl>
        </>
      ) : null}

      {!compact ? (
        <div className="pin-card-actions">
          <a className="icon-link" href={mapsUrl} target="_blank" rel="noreferrer">
            <MapPinned size={16} />
            Maps
          </a>
          {sourceUrl ? (
            <a className="icon-link" href={sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              Source
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function statusIcon(status: PinProgress["status"]) {
  if (status === "verified" || status === "team-verified") {
    return <CheckCircle2 size={15} />;
  }

  if (status === "needs-review") {
    return <TriangleAlert size={15} />;
  }

  return status === "unvisited" ? <CircleDot size={15} /> : <Radio size={15} />;
}

function pathwayLabel(pathway: TourPathway) {
  const labels: Record<TourPathway, string> = {
    spine: "Spine",
    east: "East",
    west: "West",
    transit: "Transit",
  };

  return labels[pathway];
}

function accessLabel(accessType: TourPin["wifi"]["accessType"]) {
  const labels: Record<TourPin["wifi"]["accessType"], string> = {
    free: "Free",
    "limited-free": "Limited free",
    partner: "Partner",
    credentialed: "Credentialed",
    "needs-recon": "Needs recon",
  };

  return labels[accessType];
}

function liveStatusLabel(liveStatus: TourPin["wifi"]["liveStatus"]) {
  if (liveStatus === "up") {
    return "Up";
  }

  if (liveStatus === "down") {
    return "Down";
  }

  if (liveStatus === "not-live") {
    return "Not live";
  }

  return "Unknown";
}
