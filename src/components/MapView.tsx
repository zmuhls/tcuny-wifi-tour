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

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });

    resizeObserver.observe(elementRef.current);
    setTimeout(() => map.invalidateSize({ animate: false }), 0);

    return () => {
      resizeObserver.disconnect();
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
    const selectedPin = pins.find((pin) => pin.id === selectedPinId);
    const selectedRouteLatLngs = selectedPin
      ? getSelectedPingPath(routeLatLngs, selectedPin)
      : [];
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
        weight: 3,
        opacity: 0.34,
        lineCap: "round",
      },
    ).addTo(routeLayer);

    if (selectedRouteLatLngs.length > 1) {
      L.polyline(
        selectedRouteLatLngs,
        {
          color: "#061119",
          weight: 9,
          opacity: 0.74,
          lineCap: "round",
        },
      ).addTo(routeLayer);

      L.polyline(
        selectedRouteLatLngs,
        {
          color: "#bdf7ee",
          weight: 4,
          opacity: 0.96,
          dashArray: "10 9",
          lineCap: "round",
          lineJoin: "round",
        },
      ).addTo(routeLayer);
    }

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
        routeLatLngs.length > 1
          ? routeLatLngs
          : pins.map((pin) => L.latLng(pin.latitude, pin.longitude));
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
        color: "#5aa8b5",
        dashArray: "6 8",
        fillColor: "#7fd1c7",
        fillOpacity: 0.06,
        interactive: false,
        opacity: 0.78,
        weight: 1.25,
      },
    ).addTo(map);
    selectedCircleRef.current.bringToBack();
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

    const targetZoom = focusRequest.zoom === "close" ? 16 : 15;
    const selectedBounds = L.latLng(selected.latitude, selected.longitude).toBounds(
      Math.max(selected.radiusMeters * 2.6, 220),
    );

    map.flyToBounds(selectedBounds, {
      animate: true,
      duration: 0.65,
      easeLinearity: 0.25,
      maxZoom: targetZoom,
      paddingTopLeft: [34, 88],
      paddingBottomRight: [34, 54],
    });
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

function getSelectedPingPath(routeLatLngs: L.LatLng[], selectedPin: TourPin) {
  if (!routeLatLngs.length) {
    return [L.latLng(selectedPin.latitude, selectedPin.longitude)];
  }

  const selectedLatLng = L.latLng(selectedPin.latitude, selectedPin.longitude);
  const closestRouteIndex = getClosestRouteIndex(routeLatLngs, selectedLatLng);
  const activeRoute = routeLatLngs.slice(0, closestRouteIndex + 1);
  const connector = getManhattanGridConnector(
    routeLatLngs[closestRouteIndex],
    selectedLatLng,
  );

  return [...activeRoute, ...connector.slice(1)];
}

function getClosestRouteIndex(routeLatLngs: L.LatLng[], target: L.LatLng) {
  return routeLatLngs.reduce(
    (closest, point, index) => {
      const distance = point.distanceTo(target);

      return distance < closest.distance ? { distance, index } : closest;
    },
    { distance: Number.POSITIVE_INFINITY, index: 0 },
  ).index;
}

function getManhattanGridConnector(start: L.LatLng, end: L.LatLng) {
  if (start.distanceTo(end) < 35) {
    return [start, end];
  }

  const origin = {
    latitude: (start.lat + end.lat) / 2,
    longitude: (start.lng + end.lng) / 2,
  };
  const startMeters = projectLatLng(start, origin);
  const endMeters = projectLatLng(end, origin);
  const startGrid = rotateToManhattanGrid(startMeters);
  const endGrid = rotateToManhattanGrid(endMeters);
  const firstLegIsAvenue =
    Math.abs(endGrid.avenue - startGrid.avenue) >=
    Math.abs(endGrid.street - startGrid.street);
  const bendGrid = firstLegIsAvenue
    ? { avenue: endGrid.avenue, street: startGrid.street }
    : { avenue: startGrid.avenue, street: endGrid.street };
  const bendMeters = rotateFromManhattanGrid(bendGrid);

  return [start, unprojectLatLng(bendMeters, origin), end];
}

function projectLatLng(
  point: L.LatLng,
  origin: { latitude: number; longitude: number },
) {
  const metersPerLongitude =
    111_320 * Math.cos((origin.latitude * Math.PI) / 180);

  return {
    x: (point.lng - origin.longitude) * metersPerLongitude,
    y: (point.lat - origin.latitude) * 110_540,
  };
}

function unprojectLatLng(
  point: { x: number; y: number },
  origin: { latitude: number; longitude: number },
) {
  const metersPerLongitude =
    111_320 * Math.cos((origin.latitude * Math.PI) / 180);

  return L.latLng(
    origin.latitude + point.y / 110_540,
    origin.longitude + point.x / metersPerLongitude,
  );
}

function rotateToManhattanGrid(point: { x: number; y: number }) {
  const avenueAxisRadians = (29 * Math.PI) / 180;
  const avenueX = Math.sin(avenueAxisRadians);
  const avenueY = Math.cos(avenueAxisRadians);
  const streetX = avenueY;
  const streetY = -avenueX;

  return {
    avenue: point.x * avenueX + point.y * avenueY,
    street: point.x * streetX + point.y * streetY,
  };
}

function rotateFromManhattanGrid(point: { avenue: number; street: number }) {
  const avenueAxisRadians = (29 * Math.PI) / 180;
  const avenueX = Math.sin(avenueAxisRadians);
  const avenueY = Math.cos(avenueAxisRadians);
  const streetX = avenueY;
  const streetY = -avenueX;

  return {
    x: point.avenue * avenueX + point.street * streetX,
    y: point.avenue * avenueY + point.street * streetY,
  };
}

function markerHtml(
  pin: TourPin,
  progress: PinProgress,
  isSelected: boolean,
  routeOrder: number,
) {
  const isLocatorPin = pin.category === "linknyc-locator";
  const locatorProductClass =
    isLocatorPin && pin.metadata?.linknycProductGroup === "Link5G"
      ? "marker-link5g"
      : isLocatorPin
        ? "marker-link-kiosk"
        : "";
  const locatorStatusClass =
    isLocatorPin && pin.metadata?.linknycAvailability === "coming-soon"
      ? "marker-coming-soon"
      : isLocatorPin
        ? "marker-live"
        : "";
  const symbol =
    progress.status === "team-verified"
      ? "✓✓"
      : progress.status === "verified"
        ? "✓"
        : progress.status === "needs-review"
          ? "?"
          : routeOrder > -1
            ? String(routeOrder + 1)
            : "";

  return `<span class="tour-marker marker-${pin.category} ${locatorProductClass} ${locatorStatusClass} marker-${pin.role} marker-${progress.status} ${
    isSelected ? "marker-selected" : ""
  }" aria-hidden="true">${symbol}</span>`;
}
