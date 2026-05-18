import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Database,
  ListChecks,
  RefreshCcw,
  Route,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { FilterBar } from "./components/FilterBar";
import { JoinPanel } from "./components/JoinPanel";
import { MapView } from "./components/MapView";
import { PinCard } from "./components/PinCard";
import { PingPanel } from "./components/PingPanel";
import { WifiWallPanel } from "./components/WifiWallPanel";
import { pins, routeStops, walkingRoutePath } from "./data/tour";
import { isSupabaseConfigured } from "./lib/supabase";
import { useTourStore } from "./lib/useTourStore";
import type { PinCategory, RouteStage, TourPathway, TourPin } from "./types";

const defaultCategories: PinCategory[] = [
  "library",
  "park",
  "linknyc",
  "subway",
  "cuny",
  "public-service",
  "third-space",
];

type ActivePathway = TourPathway | "all";

const pathwayOptions: { id: ActivePathway; label: string }[] = [
  { id: "spine", label: "Spine" },
  { id: "east", label: "East" },
  { id: "west", label: "West" },
  { id: "transit", label: "Transit" },
  { id: "all", label: "All" },
];

const stageLabels: Record<RouteStage, string> = {
  origin: "Start",
  midtown: "Midtown",
  "union-square": "Union Square",
  downtown: "Downtown",
  uptown: "Uptown",
  return: "Return",
};

const initialPinId =
  pins.find((pin) => pin.metadata?.privateTest === "true")?.id ??
  "nypl-schwarzman";

export default function App() {
  const {
    event,
    contributor,
    pings,
    anecdotes,
    join,
    leave,
    addPing,
    addAnecdote,
    getProgress,
    resetPings,
  } = useTourStore();
  const [selectedPinId, setSelectedPinId] = useState(initialPinId);
  const [focusRequest, setFocusRequest] = useState<{
    pinId: string;
    count: number;
    zoom: "near" | "close" | "overview";
  }>({
    pinId: initialPinId,
    count: 0,
    zoom: "near",
  });
  const [activeCategories, setActiveCategories] = useState(
    () => new Set<PinCategory>(defaultCategories),
  );
  const [activePathway, setActivePathway] = useState<ActivePathway>("all");

  const visiblePins = useMemo(
    () =>
      pins.filter(
        (pin) =>
          activeCategories.has(pin.category) &&
          pinMatchesPathway(pin, activePathway),
      ),
    [activeCategories, activePathway],
  );

  const pathwayCounts = useMemo(
    () =>
      pathwayOptions.reduce(
        (counts, option) => ({
          ...counts,
          [option.id]: pins.filter(
            (pin) =>
              activeCategories.has(pin.category) &&
              pinMatchesPathway(pin, option.id),
          ).length,
        }),
        {} as Record<ActivePathway, number>,
      ),
    [activeCategories],
  );

  const selectedPin = useMemo(
    () =>
      visiblePins.find((pin) => pin.id === selectedPinId) ??
      pins.find((pin) => pin.id === selectedPinId) ??
      pins[0],
    [selectedPinId, visiblePins],
  );

  const selectPin = useCallback(
    (pinId: string) => {
      const repeated = pinId === selectedPinId;
      setSelectedPinId(pinId);
      setFocusRequest((current) => ({
        pinId,
        count: current.count + 1,
        zoom: repeated ? "close" : "near",
      }));
    },
    [selectedPinId],
  );

  const overviewPin = useCallback((pinId: string) => {
    setSelectedPinId(pinId);
    setFocusRequest((current) => ({
      pinId,
      count: current.count + 1,
      zoom: "overview",
    }));
  }, []);

  useEffect(() => {
    if (!visiblePins.some((pin) => pin.id === selectedPinId) && visiblePins[0]) {
      selectPin(visiblePins[0].id);
    }
  }, [selectedPinId, selectPin, visiblePins]);

  const toggleCategory = useCallback((category: PinCategory) => {
    setActiveCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }

      return next.size ? next : current;
    });
  }, []);

  const requiredPins = pins.filter((pin) => pin.role === "required");
  const verifiedRequired = requiredPins.filter((pin) => {
    const progress = getProgress(pin);
    return progress.status === "verified" || progress.status === "team-verified";
  });
  const verifiedPins = pins.filter((pin) => {
    const progress = getProgress(pin);
    return progress.status === "verified" || progress.status === "team-verified";
  });
  const reviewCount = pings.filter((ping) => ping.status === "needs_review").length;

  return (
    <main className="app-shell">
      <a className="skip-link" href="#tour-map">
        Skip to map
      </a>
      <a className="skip-link" href="#selected-access-point">
        Skip to selected stop
      </a>

      <aside className="control-panel" id="tour-controls" aria-label="Tour controls">
        <header className="app-header">
          <div className="brand-mark">
            <Wifi size={24} />
          </div>
          <div>
            <p className="eyebrow">Teach@CUNY Summer Institute</p>
            <h1>Manhattan Free Wi-Fi Walking Tour</h1>
          </div>
        </header>

        <section className="route-summary">
          <div>
            <Route size={18} />
            <span>Bryant Park → Union Square → return</span>
          </div>
        </section>

        <PathwayBar
          active={activePathway}
          counts={pathwayCounts}
          onChange={setActivePathway}
        />

        <JoinPanel contributor={contributor} onJoin={join} onLeave={leave} />

        <WifiWallPanel
          contributor={contributor}
          anecdotes={anecdotes}
          onAdd={addAnecdote}
        />

        <section className="stats-grid" aria-label="Tour progress">
          <StatCard
            icon={<ListChecks size={17} />}
            label="Required stops"
            value={`${verifiedRequired.length}/${requiredPins.length}`}
          />
          <StatCard
            icon={<ShieldCheck size={17} />}
            label="Verified pins"
            value={`${verifiedPins.length}`}
          />
          <StatCard
            icon={<Activity size={17} />}
            label="Pings"
            value={`${pings.length}`}
          />
          <StatCard
            icon={<Database size={17} />}
            label="Review"
            value={`${reviewCount}`}
          />
        </section>

        <FilterBar active={activeCategories} onToggle={toggleCategory} />

        <section className="pin-list" aria-label="Wi-Fi access points">
          {Object.entries(stageLabels).map(([stage, label]) => {
            const stagePins = visiblePins.filter((pin) => pin.stage === stage);
            if (!stagePins.length) {
              return null;
            }

            return (
              <div className="stage-group" key={stage}>
                <h2>{label}</h2>
                {stagePins.map((pin) => (
                  <PinCard
                    compact
                    key={pin.id}
                    pin={pin}
                    progress={getProgress(pin)}
                    selected={pin.id === selectedPinId}
                    onSelect={selectPin}
                    onOverview={overviewPin}
                  />
                ))}
              </div>
            );
          })}
        </section>

        <section className="source-panel">
          <p>
            Mode:{" "}
            <strong>{isSupabaseConfigured ? "configured" : "local browser store"}</strong>
          </p>
          {pings.length ? (
            <button className="ghost-button" type="button" onClick={resetPings}>
              <RefreshCcw size={16} />
              Clear local pings
            </button>
          ) : null}
        </section>
      </aside>

      <section
        className="map-area"
        id="tour-map"
        aria-label="Interactive Manhattan map"
        tabIndex={-1}
      >
        <MapView
          pins={visiblePins}
          routeStopIds={routeStops}
          walkingRoutePath={walkingRoutePath}
          selectedPinId={selectedPin.id}
          focusRequest={focusRequest}
          onSelectPin={selectPin}
          onOverviewPin={overviewPin}
          getProgress={getProgress}
        />
        <div className="map-scale-overlay" aria-label="Tour scale">
          <span>Manhattan</span>
          <strong>Institutional Wi-Fi layer + field corridor</strong>
          <span>Route core: 42nd to 14th</span>
        </div>
        <div className="map-plot-overlay" aria-label="Map plot count">
          <span>{visiblePins.length} plotted access points</span>
          <span>{requiredPins.length} required stops</span>
        </div>
      </section>

      <aside
        className="detail-panel"
        id="selected-access-point"
        aria-label="Selected access point"
        tabIndex={-1}
      >
        <PinCard pin={selectedPin} progress={getProgress(selectedPin)} selected />
        <PingPanel
          pin={selectedPin}
          contributor={contributor}
          maxGpsAccuracyMeters={event.maxGpsAccuracyMeters}
          onPing={addPing}
        />
      </aside>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="stat-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PathwayBar({
  active,
  counts,
  onChange,
}: {
  active: ActivePathway;
  counts: Record<ActivePathway, number>;
  onChange: (pathway: ActivePathway) => void;
}) {
  return (
    <section className="pathway-bar" aria-label="Route pathway">
      <div className="pathway-grid">
        {pathwayOptions.map((option) => (
          <button
            className={`pathway-chip ${active === option.id ? "active" : ""}`}
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active === option.id}
          >
            <span>{option.label}</span>
            <em>{counts[option.id]} pins</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function pinMatchesPathway(pin: TourPin, pathway: ActivePathway) {
  if (pathway === "all") {
    return true;
  }

  if (pin.pathways?.includes(pathway)) {
    return true;
  }

  if (pathway === "transit") {
    return pin.category === "subway" || pin.stage === "return";
  }

  if (pin.role === "required") {
    return true;
  }

  if (pathway === "east") {
    return pin.longitude > -73.984 && pin.category !== "third-space";
  }

  if (pathway === "west") {
    return pin.longitude < -73.994 || pin.wifi.provider === "Chelsea";
  }

  return pin.longitude >= -73.994 && pin.longitude <= -73.984;
}
