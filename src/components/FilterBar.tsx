import { Check, Filter } from "lucide-react";
import type { PinCategory } from "../types";

const labels: Record<PinCategory, string> = {
  library: "Libraries",
  park: "Parks",
  linknyc: "LinkNYC",
  "linknyc-locator": "Link locator",
  subway: "Subway",
  cuny: "CUNY",
  "public-service": "Public",
  "third-space": "Third spaces",
};

interface FilterBarProps {
  active: Set<PinCategory>;
  onToggle: (category: PinCategory) => void;
}

export function FilterBar({ active, onToggle }: FilterBarProps) {
  return (
    <section className="filter-bar" aria-label="Pin filters">
      <div className="filter-title">
        <Filter size={16} />
        Layers
      </div>
      <div className="filter-grid">
        {(Object.keys(labels) as PinCategory[]).map((category) => (
          <button
            className={`filter-chip chip-${category} ${
              active.has(category) ? "active" : ""
            }`}
            key={category}
            type="button"
            onClick={() => onToggle(category)}
            aria-pressed={active.has(category)}
          >
            {active.has(category) ? <Check size={14} /> : null}
            {labels[category]}
          </button>
        ))}
      </div>
      {active.has("linknyc-locator") ? (
        <div className="locator-key" aria-label="LinkNYC locator marker key">
          <span>
            <i className="locator-swatch locator-kiosk" />
            Kiosk
          </span>
          <span>
            <i className="locator-swatch locator-5g" />
            Link5G
          </span>
          <span>
            <i className="locator-swatch locator-soon" />
            Coming soon
          </span>
        </div>
      ) : null}
    </section>
  );
}
