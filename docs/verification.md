# Verification Model

The tour should be easy enough to use while walking, but strict enough that a checkmark means something.

## Verified

A ping is `verified` when all criteria pass:

- active contributor session created with the event access code;
- GPS fix is inside the pin radius;
- GPS accuracy is no worse than the event threshold;
- selected SSID exactly matches one assigned SSID for the pin;
- the app receives a live server ping from that device.

## Needs Review

A ping is `needs_review` when the participant is plausibly nearby but the proof is weak:

- GPS accuracy is too broad;
- server ping fails;
- the pin is a recon/cafe/third-space candidate.

## Rejected

A ping is `rejected` when it is outside the geofence, lacks a valid contributor session, does not include an assigned Wi-Fi selection, or claims a Wi-Fi network that is not assigned to the selected pin. Rejected pings remain useful as teaching data, but they do not check off the stop.

## Browser Constraint

Mobile browsers intentionally do not expose the connected SSID in a reliable, portable way. For the Summer Institute version, SSID is self-reported and combined with GPS and live reachability. A stricter future version could add captive-portal tokens, QR codes at each stop, server-captured IP/ASN, or a native companion app.
