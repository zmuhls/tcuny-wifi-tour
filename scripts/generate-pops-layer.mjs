import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const POPS_PAGE =
  "https://www.nyc.gov/content/planning/pages/our-work/plans/citywide/privately-owned-public-spaces";
const POPS_OPEN_DATA =
  "https://data.cityofnewyork.us/City-Government/Privately-Owned-Public-Spaces-POPS-/rvih-nhyn";
const POPS_API_URL =
  "https://data.cityofnewyork.us/resource/rvih-nhyn.json?$limit=5000";
const OUTPUT_PATH = "../public/data/popsLayer.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, OUTPUT_PATH);

const response = await fetch(POPS_API_URL);
if (!response.ok) {
  throw new Error(`Failed to fetch ${POPS_API_URL}: ${response.status}`);
}

const rows = await response.json();
if (!Array.isArray(rows)) {
  throw new Error("POPS API returned an unexpected payload");
}

const generatedAt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const pins = rows
  .filter((row) => row.borough_name === "Manhattan")
  .map(rowToPin)
  .filter(Boolean)
  .sort((a, b) => b.latitude - a.latitude || a.longitude - b.longitude);

pins.unshift(oneBryantParkReconPin(generatedAt));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(pins)}\n`);

console.log(
  `Wrote ${pins.length} Manhattan POPS/recon pins to ${path.relative(
    process.cwd(),
    outputPath,
  )}`,
);

function rowToPin(row) {
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const address = clean(row.building_address_with_zip) || addressFromParts(row);
  const buildingName = clean(row.building_name);
  const publicSpaceType = clean(row.public_space_type) || "Privately owned public space";
  const accessHours = clean(row.hour_of_access_required) || "Hours not listed";
  const amenities = clean(row.amenities_required) || "Amenities not listed";
  const title =
    buildingName || titleCase(address.replace(/, New York, NY .*/, "")) || row.pops_number;

  return {
    id: `pops-${slug(row.pops_number || `${address}-${latitude}-${longitude}`)}`,
    name: `${title} POPS`,
    shortName: shortName(title),
    category: "pops",
    stage: stageForLatitude(latitude),
    role: "recon",
    latitude,
    longitude,
    radiusMeters: radiusForSpace(publicSpaceType),
    address,
    description:
      "Official NYC Planning POPS record. Use this as a field prompt for public access, private control, required amenities, and any available Wi-Fi.",
    wifi: {
      provider: "Privately owned public space",
      ssids: ["Ask on site / field-confirm"],
      accessType: "needs-recon",
      locationType: publicSpaceType,
      statusLabel: `${accessHours}; Wi-Fi unverified`,
      statusDate: generatedAt,
      remarks: `Required amenities: ${summarizeAmenities(amenities)}`,
      sourceId: `NYC Planning POPS ${row.pops_number}`,
      liveStatus: "unknown",
    },
    sourceLinks: [
      { label: "NYC Planning POPS", url: POPS_PAGE },
      { label: "NYC Open Data POPS", url: POPS_OPEN_DATA },
    ],
    mapsQuery: address || `${latitude},${longitude}`,
    pathways: pathwaysForCoordinates(latitude, longitude),
    metadata: {
      sourceDataset: "NYC Planning Privately Owned Public Spaces (POPS)",
      sourceGeneratedAt: generatedAt,
      popsNumber: row.pops_number,
      publicSpaceType,
      accessHours,
      requiredAmenities: amenities,
      communityDistrict: clean(row.community_district),
      sizeRequired: clean(row.size_required),
      accessibility: clean(row.physically_disabled),
      developer: clean(row.developer),
      fieldPrompt:
        "Observe posted rules, hours, seating, restrooms, security threshold, who appears welcome, and whether staff/building Wi-Fi is available without purchase or tenant credentials.",
    },
  };
}

function oneBryantParkReconPin(generatedAt) {
  return {
    id: "pops-recon-one-bryant-park",
    name: "Bank of America Tower / One Bryant Park recon",
    shortName: "BOA Bryant POPS?",
    category: "pops",
    stage: "origin",
    role: "recon",
    latitude: 40.7552444,
    longitude: -73.9839473,
    radiusMeters: 150,
    address: "1111 Avenue of the Americas",
    description:
      "User-suggested public/private indoor-space candidate near Bryant Park. Verify POPS signage, access rules, and Wi-Fi availability on site.",
    wifi: {
      provider: "Bank of America Tower / building-managed",
      ssids: ["Ask on site / field-confirm"],
      accessType: "needs-recon",
      locationType: "Public/private indoor space candidate",
      statusLabel: "Candidate; Wi-Fi needs field recon",
      statusDate: generatedAt,
      remarks:
        "Not matched to the official NYC Planning POPS dataset in this import; treat as a privatized-access discussion prompt until field-confirmed.",
      sourceId: "Manual recon candidate",
      liveStatus: "unknown",
    },
    sourceLinks: [
      { label: "NYC Planning POPS", url: POPS_PAGE },
      { label: "NYC Open Data POPS", url: POPS_OPEN_DATA },
    ],
    mapsQuery: "1111 Avenue of the Americas New York NY",
    pathways: ["spine", "west"],
    metadata: {
      sourceDataset: "Manual POPS/public-private recon candidate",
      sourceGeneratedAt: generatedAt,
      manualCandidate: "true",
      accessHours: "Field-confirm",
      requiredAmenities: "Field-confirm",
      fieldPrompt:
        "Confirm whether the lobby or public-facing space invites public use, whether signage identifies it as POPS, what security asks of walkers, and whether Wi-Fi can be used without purchase or tenant credentials.",
    },
  };
}

function addressFromParts(row) {
  return [clean(row.address_number), titleCase(clean(row.street_name))]
    .filter(Boolean)
    .join(" ");
}

function radiusForSpace(publicSpaceType) {
  const value = publicSpaceType.toLowerCase();

  if (
    value.includes("concourse") ||
    value.includes("connection") ||
    value.includes("galleria") ||
    value.includes("thoroughfare")
  ) {
    return 140;
  }

  if (value.includes("major public open space")) {
    return 180;
  }

  if (value.includes("covered") || value.includes("arcade")) {
    return 125;
  }

  return 105;
}

function clean(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/\s+/g, " ");
}

function titleCase(value) {
  const cleanValue = clean(value);

  if (!cleanValue || cleanValue !== cleanValue.toUpperCase()) {
    return cleanValue;
  }

  return cleanValue.toLowerCase().replace(/\b[a-z]/g, (match) => match.toUpperCase());
}

function shortName(value) {
  const cleaned = titleCase(value);

  if (cleaned.length <= 18) {
    return cleaned;
  }

  return `${cleaned.slice(0, 16).trim()}...`;
}

function summarizeAmenities(value) {
  const amenities = clean(value);

  if (!amenities || amenities === "Amenities not listed") {
    return amenities || "Amenities not listed";
  }

  const parts = amenities
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 5) {
    return parts.join("; ");
  }

  return `${parts.slice(0, 5).join("; ")}; +${parts.length - 5} more`;
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stageForLatitude(latitude) {
  if (latitude >= 40.758) {
    return "uptown";
  }

  if (latitude <= 40.73) {
    return "downtown";
  }

  if (latitude < 40.738) {
    return "union-square";
  }

  return latitude >= 40.748 ? "origin" : "midtown";
}

function pathwaysForCoordinates(latitude, longitude) {
  const crossTownPathway =
    longitude < -73.994 ? "west" : longitude > -73.978 ? "east" : "spine";
  const pathways = [crossTownPathway];

  if (latitude < 40.733 || latitude > 40.758) {
    pathways.push("transit");
  }

  return Array.from(new Set(pathways));
}
