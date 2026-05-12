export type PinCategory =
  | "library"
  | "park"
  | "linknyc"
  | "subway"
  | "cuny"
  | "public-service"
  | "third-space";

export type RouteStage =
  | "origin"
  | "midtown"
  | "union-square"
  | "downtown"
  | "uptown"
  | "return";

export type TourPathway = "spine" | "east" | "west" | "transit";

export type PinRole = "required" | "optional" | "recon";

export type PinAvailability =
  | "free"
  | "limited-free"
  | "partner"
  | "credentialed"
  | "needs-recon";

export type PingStatus = "verified" | "needs_review" | "rejected";

export interface SourceLink {
  label: string;
  url: string;
}

export interface WifiMetadata {
  provider: string;
  ssids: string[];
  accessType: PinAvailability;
  locationType: string;
  statusLabel: string;
  statusDate?: string;
  remarks?: string;
  sourceId?: string;
  liveStatus?: "up" | "down" | "unknown" | "not-live";
}

export interface TourPin {
  id: string;
  name: string;
  shortName: string;
  category: PinCategory;
  stage: RouteStage;
  role: PinRole;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  address: string;
  description: string;
  wifi: WifiMetadata;
  sourceLinks: SourceLink[];
  mapsQuery: string;
  pathways?: TourPathway[];
  metadata?: Record<string, string | number | undefined>;
}

export interface TourEvent {
  id: string;
  name: string;
  accessCodes: string[];
  startsAtLabel: string;
  maxGpsAccuracyMeters: number;
  defaultRadiusMeters: number;
}

export interface Contributor {
  id: string;
  eventId: string;
  displayName: string;
  teamName: string;
  accessCode: string;
  joinedAt: string;
}

export interface PingNetworkInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface PingRecord {
  id: string;
  eventId: string;
  pinId: string;
  contributorId: string;
  contributorName: string;
  teamName: string;
  createdAt: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number | null;
  ssidClaim: string;
  serverRoundTripMs: number | null;
  distanceMeters: number;
  status: PingStatus;
  reasons: string[];
  networkInfo?: PingNetworkInfo;
}

export interface PingCandidate {
  pin: TourPin;
  event: TourEvent;
  contributor: Contributor;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number | null;
  ssidClaim: string;
  serverRoundTripMs: number | null;
  networkInfo?: PingNetworkInfo;
}

export interface PinProgress {
  pinId: string;
  status: "unvisited" | "verified" | "team-verified" | "needs-review";
  verifiedCount: number;
  needsReviewCount: number;
  teams: string[];
  latestPing?: PingRecord;
}
