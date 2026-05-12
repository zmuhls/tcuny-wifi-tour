# API Contract

The current Vite app uses local browser storage so it can run before a Supabase project exists. Production can keep the same payload shape behind serverless routes.

## `POST /join`

Input:

```json
{
  "eventId": "tcuny-summer-institute-2026",
  "displayName": "Ada",
  "teamName": "Team Library",
  "accessCode": "TCUNY2026"
}
```

Output:

```json
{
  "contributorId": "uuid",
  "eventId": "tcuny-summer-institute-2026",
  "displayName": "Ada",
  "teamName": "Team Library"
}
```

## `GET /pins`

Returns the curated pin list with provider, SSID, status, source links, category, route stage, and geofence radius.

## `POST /ping`

Input:

```json
{
  "eventId": "tcuny-summer-institute-2026",
  "pinId": "nypl-schwarzman",
  "contributorId": "uuid",
  "latitude": 40.753184,
  "longitude": -73.982158,
  "gpsAccuracyMeters": 24,
  "ssidClaim": "NYPL",
  "serverRoundTripMs": 84,
  "networkInfo": {
    "effectiveType": "4g",
    "downlink": 10,
    "rtt": 50
  }
}
```

Output:

```json
{
  "status": "verified",
  "distanceMeters": 0.4,
  "reasons": [
    "Access code, geofence, GPS accuracy, SSID claim, and server ping all passed."
  ]
}
```

## `POST /review`

Leader-only endpoint for converting `needs_review` pings to accepted/rejected review outcomes with notes.

## Scheduled `refresh-data`

Refreshes NYC Open Data and LinkNYC status fields into `pin_sources` without overwriting manually curated route language.
