import type { PingNetworkInfo } from "../types";
import { collectNetworkInfo } from "./verification";

export async function measureServerPing() {
  const start = performance.now();

  try {
    await fetch(`/?wifi-ping=${Date.now()}`, {
      cache: "no-store",
      method: "HEAD",
    });

    return Math.round(performance.now() - start);
  } catch {
    try {
      await fetch(`/?wifi-ping=${Date.now()}`, {
        cache: "no-store",
      });

      return Math.round(performance.now() - start);
    } catch {
      return null;
    }
  }
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support geolocation."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 15_000,
    });
  });
}

export function readNetworkInfo(): PingNetworkInfo {
  return collectNetworkInfo();
}
