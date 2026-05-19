# Teach@CUNY Manhattan Free Wi-Fi Walking Tour

Interactive Leaflet map for a collective free Wi-Fi walking tour that starts at NYPL/Bryant Park, moves through the Midtown/Flatiron corridor, reaches Union Square, and returns by train.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The app works immediately with browser-local storage. Use access code `TCUNY2026` to join as a contributor.

## What Is Implemented

- Responsive Manhattan Leaflet map with route line, category filters, pin metadata cards, and touch-friendly ping controls.
- Seeded route pins for NYPL/Bryant Park, LinkNYC, Andrew Heiskell Library, Madison Square Park, Union Square, subway Wi-Fi, CUNY eduroam, public-service, third-space recon, and privately owned public space layers.
- Field-ready ping verification: access-code participant, GPS geofence with device-accuracy overlap, GPS accuracy threshold, and live server reachability.
- Local realtime-style updates through `BroadcastChannel` and durable browser storage through `localStorage`.
- Supabase-ready schema in `supabase/schema.sql`; add `.env` values from `.env.example` when a project exists.

## Verification Logic

Browsers do not reliably expose the connected Wi-Fi SSID. The app therefore treats a checkoff as a field-ready evidence bundle, not forensic network proof:

- participant joined with an event access code;
- browser GPS coordinates fall inside the pin radius, or the reported device accuracy circle overlaps that radius;
- GPS accuracy is at or below 80 meters;
- the device successfully reaches the app server at ping time.

Weak GPS accuracy, failed server reachability, and recon pins become `needs_review`. Pings outside both the geofence and the reported GPS accuracy circle are `rejected` and do not check off the pin.

## Data Sources

- NYC Wi-Fi Hotspot Locations
- LinkNYC Kiosk Status
- LinkNYC How to Connect
- NYPL wireless access guidance
- CUNY eduroam
- NYC Parks Wi-Fi facilities
- Citywide Public Computer Centers
- NYC Planning / NYC Open Data Privately Owned Public Spaces (POPS)
- Free Tours by Foot NYC Wi-Fi guide
- NYC MOPD provider page

## Data Refresh

```bash
npm run generate:linknyc
npm run generate:pops
```

The POPS layer is off by default and every POPS pin is marked `needs-recon`: it is meant to help walkers compare public access, private control, required amenities, and possible building Wi-Fi without claiming that Wi-Fi is available until participants verify it on site.

## Production Notes

- GitHub Pages deploys from `.github/workflows/deploy-pages.yml`; the Pages build uses Vite base path `/tcuny-wifi-tour/`.
- Create a Supabase project and run `supabase/schema.sql`.
- Store pings through server-side routes or Supabase Edge Functions so IP/ASN and review metadata can be captured outside the browser.
- Refresh LinkNYC and NYC Open Data records before the Institute and again the morning of the walk.
- Field-test at Bryant Park and Union Square to tune radii and expected SSID labels.
