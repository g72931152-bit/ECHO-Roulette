# ELVAR — random video chat v2

ELVAR is the redesigned version of the project previously named ECHO. The Cloudflare Worker name remains `echo-roulette` so an existing deployment can be updated without renaming the Worker.

## What changed

- Redesigned strict/minimal UI with restrained motion, non-overlapping search figures, clearer room hierarchy, and compact responsive controls.
- Local profile: name, email, country, target country, bio, icon/image.
- Target-country matchmaking.
- Peer profile card with declared country and Cloudflare Edge country signal.
- In-call chat through the same WebSocket signaling channel with server acknowledgement and visible delivery state.
- Away status.
- Draggable local picture-in-picture window; position persists locally.
- Camera preview filters and mirror toggle.
- Voice level control plus browser audio effects: high, deep, robot and radio.
- Reaction sounds that can be mixed into the outgoing audio track, with a local on/off switch.
- Network metrics: local WebSocket RTT, peer WebRTC RTT and an estimated voice-delivery delay.
- Snake and reaction mini-games.
- Report and feedback storage in the Durable Object.
- Server-authoritative owner badge for the configured owner email (email is not shown to peers).
- Admin panel with active-user list and server-side ban/unban actions protected by `ADMIN_TOKEN`.
- Optional Cloudflare Email Service delivery for reports/feedback.
- WebRTC stays peer-to-peer; Worker/Durable Object is used for matchmaking and signaling.

## Important account note

The current profile is **local to the browser**. It is not a real cross-device account system yet, and email is not verified. The owner badge is a visual convenience; real ban authority is protected by `ADMIN_TOKEN` on the Worker. A production authentication system should be added before treating email addresses as verified identities.

## Cloudflare

The project now uses the declarative Durable Object `exports` configuration with SQLite. Cloudflare's current documentation recommends this configuration for new SQLite-backed Durable Objects and supports migrating an existing Worker from the older `migrations` array without moving the namespace data.

Keep the Worker root as `/` and deploy with:

```text
npx wrangler deploy
```

A compatibility date of `2026-09-01` is intentionally used instead of a date near the current day, avoiding the future-date validation error you previously hit.

## Admin

Create a Cloudflare Worker secret:

```text
ADMIN_TOKEN = a long random secret
```

Optionally create a non-secret variable:

```text
ADMIN_EMAIL = your-owner-email@example.com
```

The UI compares the local profile email with the configured owner email for the OWNER badge. When an owner profile opens Settings → Admin, paste `ADMIN_TOKEN` into the session-only key prompt. Bans are enforced by the Durable Object using the persistent local `profileId` stored with the profile. This is intentionally separate from the visual owner badge.

## Email

Reports and feedback are always stored in the Durable Object. Automatic email sending is optional and requires Cloudflare Email Service; the current Email Sending product is a Workers Paid feature. Without it, reports are stored in the admin panel and feedback falls back to mailto. When Cloudflare Email Service is configured and the Worker has an `EMAIL` binding plus `SUPPORT_FROM`, the Worker also sends the message to the configured owner email. Otherwise the browser falls back to a `mailto:` link for feedback.

Cloudflare's Email Service docs describe the `send_email` binding and the `send()` API. Email Sending requires an onboarded domain; the project therefore does not hard-code an unverified sender address.

## Local validation

```bash
npm install
npm run check
```

The check suite runs Worker/client syntax checks, HTML/JS selector validation and the matchmaking stress test.

## TURN

The project currently uses STUN only. Direct WebRTC works for many network combinations, but a large public service should add TURN relay capacity for networks where direct ICE connectivity fails. No unknown third-party TURN credentials are embedded in the repository.
