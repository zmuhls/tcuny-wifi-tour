const EARTH_RADIUS_METERS = 6_371_000;

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const phiA = toRadians(a.latitude);
  const phiB = toRadians(b.latitude);
  const deltaPhi = toRadians(b.latitude - a.latitude);
  const deltaLambda = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phiA) * Math.cos(phiB) * Math.sin(deltaLambda / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatMeters(value: number) {
  if (value < 1000) {
    return `${Math.round(value)} m`;
  }

  return `${(value / 1000).toFixed(2)} km`;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
