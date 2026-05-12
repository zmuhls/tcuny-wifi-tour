import { useEffect, useRef } from "react";
import L from "leaflet";
import type { PinProgress, TourPin } from "../types";

interface MapViewProps {
  pins: TourPin[];
  routeStopIds: string[];
  walkingRoutePath: readonly (readonly [number, number])[];
  selectedPinId: string;
  focusRequest: {
    pinId: string;
    count: number;
    zoom: "near" | "close" | "overview";
  };
  onSelectPin: (pinId: string) => void;
  onOverviewPin: (pinId: string) => void;
  getProgress: (pin: TourPin) => PinProgress;
}

export function MapView({
  pins,
  routeStopIds,
  walkingRoutePath,
  selectedPinId,
  focusRequest,
  onSelectPin,
  onOverviewPin,
  getProgress,
}: MapViewProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedCircleRef = useRef<L.Circle | null>(null);
  const routeFitRef = useRef(false);
  const lastFocusCountRef = useRef(0);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) {
      return;
    }

    const map = L.map(elementRef.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      maxBounds: [
        [40.68, -74.05],
        [40.89, -73.9],
      ],
      maxBoundsViscosity: 0.35,
    }).setView([40.7457, -73.9911], 14);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ imperial: true, metric: false, position: "bottomleft" }).addTo(
      map,
    );
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 20,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    ).addTo(map);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
      {
        className: "street-label-tiles",
        opacity: 0.62,
        maxZoom: 20,
        attribution: "",
      },
    ).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      opacity: 0,
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });

    markerLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    const routeLayer = routeLayerRef.current;

    if (!map || !markerLayer || !routeLayer) {
      return;
    }

    markerLayer.clearLayers();
    routeLayer.clearLayers();

    const routePins = routeStopIds
      .map((id) => pins.find((pin) => pin.id === id))
      .filter(Boolean) as TourPin[];
    const routeLatLngs = getRouteLatLngs(walkingRoutePath, routePins);
    const requiredRouteIds = Array.from(
      new Set(
        routeStopIds.filter(
          (id) => pins.find((pin) => pin.id === id)?.role === "required",
        ),
      ),
    );

    L.polyline(
      routeLatLngs,
      {
        color: "#09161f",
        weight: 12,
        opacity: 0.88,
      },
    ).addTo(routeLayer);

    L.polyline(
      routeLatLngs,
      {
        color: "#78d7c7",
        weight: 4,
        opacity: 0.92,
        dashArray: "12 10",
        lineCap: "round",
      },
    ).addTo(routeLayer);

    routePins.forEach((pin, index) => {
      L.circleMarker([pin.latitude, pin.longitude], {
        radius: index === 0 ? 7 : 5,
        color: "#d7fff5",
        fillColor: "#78d7c7",
        fillOpacity: 0.74,
        opacity: 0.84,
        weight: 1.5,
      }).addTo(routeLayer);
    });

    pins.forEach((pin) => {
      const progress = getProgress(pin);
      const isSelected = pin.id === selectedPinId;
      const routeOrder =
        pin.role === "required"
          ? requiredRouteIds.findIndex((id) => id === pin.id)
          : -1;
      const marker = L.marker([pin.latitude, pin.longitude], {
        icon: L.divIcon({
          className: "tour-marker-host",
          html: markerHtml(pin, progress, isSelected, routeOrder),
          iconSize: [42, 42],
          iconAnchor: [21, 21],
        }),
        keyboard: true,
        title: pin.name,
      });

      marker.on("click", () => onSelectPin(pin.id));
      marker.on("dblclick", (event) => {
        L.DomEvent.stop(event);
        onOverviewPin(pin.id);
      });
      marker.bindTooltip(pin.shortName, {
        direction: "top",
        offset: [0, -18],
        opacity: 0.92,
      });
      marker.addTo(markerLayer);
    });

    if (!routeFitRef.current && (pins.length > 1 || routeLatLngs.length > 1)) {
      const initialLatLngs =
        pins.length > 1
          ? pins.map((pin) => L.latLng(pin.latitude, pin.longitude))
          : routeLatLngs;
      const bounds = L.latLngBounds(initialLatLngs);
      map.fitBounds(bounds, {
        paddingTopLeft: [30, 30],
        paddingBottomRight: [30, 80],
        maxZoom: 14,
      });
      routeFitRef.current = true;
    }
  }, [
    getProgress,
    onOverviewPin,
    onSelectPin,
    pins,
    routeStopIds,
    selectedPinId,
    walkingRoutePath,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = pins.find((pin) => pin.id === selectedPinId);

    if (!map || !selected) {
      return;
    }

    selectedCircleRef.current?.remove();
    selectedCircleRef.current = L.circle(
      [selected.latitude, selected.longitude],
      {
        radius: selected.radiusMeters,
        color: "#1f6f8b",
        fillColor: "#7fd1c7",
        fillOpacity: 0.12,
        weight: 2,
      },
    ).addTo(map);
  }, [pins, selectedPinId]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = pins.find((pin) => pin.id === focusRequest.pinId);

    if (!map || !selected || focusRequest.count === lastFocusCountRef.current) {
      return;
    }

    lastFocusCountRef.current = focusRequest.count;

    if (focusRequest.zoom === "overview") {
      const routeLatLngs = getRouteLatLngs(walkingRoutePath, pins);
      if (routeLatLngs.length > 1) {
        map.flyToBounds(L.latLngBounds(routeLatLngs), {
          paddingTopLeft: [30, 30],
          paddingBottomRight: [30, 80],
          maxZoom: 15,
        });
      }

      return;
    }

    const targetZoom = focusRequest.zoom === "close" ? 18 : 16;

    map.flyTo(
      [selected.latitude, selected.longitude],
      Math.max(map.getZoom(), targetZoom),
      {
        animate: true,
        duration: 0.65,
        easeLinearity: 0.25,
      },
    );
  }, [focusRequest, pins, walkingRoutePath]);

  return <div className="map-canvas" ref={elementRef} aria-label="Tour map" />;
}

function getRouteLatLngs(
  walkingRoutePath: readonly (readonly [number, number])[],
  fallbackPins: TourPin[],
) {
  return walkingRoutePath.length > 1
    ? walkingRoutePath.map(([latitude, longitude]) => L.latLng(latitude, longitude))
    : fallbackPins.map((pin) => L.latLng(pin.latitude, pin.longitude));
}

function markerHtml(
  pin: TourPin,
  progress: PinProgress,
  isSelected: boolean,
  routeOrder: number,
) {
  const symbol =
    progress.status === "team-verified"
      ? "✓✓"
      : progress.status === "verified"
        ? "✓"
        : progress.status === "needs-review"
          ? "?"
          : routeOrder > -1
            ? String(routeOrder + 1)
            : "•";

  return `<span class="tour-marker marker-${pin.category} marker-${pin.role} marker-${progress.status} ${
    isSelected ? "marker-selected" : ""
  }" aria-hidden="true">${symbol}</span>`;
}
