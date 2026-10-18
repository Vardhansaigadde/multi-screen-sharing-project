# ScreenHub

Many laptops share their screens into one room. The host sees every screen at once in a grid and can click any screen to see it full size.

Built with Next.js, TypeScript, Tailwind CSS and [LiveKit](https://livekit.io) (open-source WebRTC media server).

## How it works

- **Host** creates a room and gets a private host link. The host can watch every screen but publishes nothing.
- **Participants** join with the room code (or by scanning the QR code) and share their screen. They cannot see anyone else's screen.
- These permissions are enforced by the LiveKit server through the access token, not only by the UI.
- Each screen is sent in two qualities: 360p for grid tiles and 1080p for the full-size view. Tiles on other pages are paused, so the host only downloads what is on screen.

## Run it locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` (already done once).
3. Start a local LiveKit server in dev mode: `livekit-server --dev`
4. Start the app: `npm run dev`
5. Open http://localhost:3000, click **Create room**, then open the join link in another tab and share a screen.

## Use LiveKit Cloud instead

Create a free project at https://cloud.livekit.io and put its URL, API key and API secret in `.env.local`.

## Project structure

```
app/
  page.tsx               Home: create or join a room
  host/[code]/page.tsx   Host dashboard
  room/[code]/page.tsx   Participant page
  api/rooms/route.ts     Creates a room code and host key
  api/token/route.ts     Issues LiveKit access tokens with role permissions
components/
  HostDashboard.tsx      Grid, pagination, full-size view
  ParticipantView.tsx    Join form and screen share button
  InvitePanel.tsx        QR code and join link
lib/
  livekit-server.ts      Server-only helpers (room codes, host keys)
  api.ts                 Client helpers
```
