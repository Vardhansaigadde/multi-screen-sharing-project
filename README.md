# OmniScreen

Live multi-screen sharing and monitoring. Many laptops share their screens into one room, the host sees every screen at once in a grid, and can click any screen to see it full size.

**Live demo:** https://omniscreen.vercel.app

Built with Next.js, TypeScript, Tailwind CSS and [LiveKit](https://livekit.io) (open-source WebRTC media server).

## Features

- **Rooms with a 6-letter code.** Participants open the site and type the code, or use the direct link. No install or sign-up.
- **Host-only monitoring.** The host watches every shared screen; participants can only share and never see each other's screens.
- **Live grid** that adjusts to the number of screens, with pages of 25 for large rooms.
- **Click to enlarge** any screen in full quality. Arrow keys move between screens, Esc returns to the grid.
- **Show to everyone.** The host can present one student's screen to the whole room.
- **Pin and search.** Pin important screens to the top and find anyone by name.
- **Connection quality** shown as small signal bars on each screen.
- **Attendance.** A live list of who joined and left, exportable as a CSV file for Excel.
- **Stop-sharing alerts** (optional) pop up when someone stops sharing.
- **Remove participant** and **End session** for the host.
- **Dark dashboard** designed to look clear on a projector.

## How it works

```
 Participant laptops ──screen video──▶  LiveKit server  ──▶  Host dashboard
                                             ▲
 Browser ──"join room X"──▶ Next.js API ─────┘ (signed access token)
```

- The Next.js backend issues signed LiveKit access tokens. Permissions are enforced by the LiveKit server, not only by the UI:
  - **Host:** can watch, cannot publish, hidden from the participant list
  - **Participant:** can publish a screen share only. Each participant's app allows only the host to subscribe to its screen, except the one the host is showing to everyone. LiveKit enforces these permissions on the server.
- The host link carries a host key (an HMAC of the room code), so only the room's creator can watch or end it. No database is needed.
- Each screen is sent in two qualities: 360p for grid tiles and 1080p for the full-size view. Tiles that aren't visible are paused, so the host only downloads what is on screen. This keeps rooms of 50+ people light enough for the free tier.

## Run it locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local`.
3. Download the [LiveKit server](https://github.com/livekit/livekit/releases) and start it in dev mode:
   ```bash
   livekit-server --dev
   ```
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000, click **Create room**, then open the join link in another window and share a screen.

Browsers only allow screen sharing on `localhost` or HTTPS, so testing with other devices needs the deployed site.

## Deploy

1. Create a free project at [LiveKit Cloud](https://cloud.livekit.io).
2. Import this repo into [Vercel](https://vercel.com).
3. Add the environment variables `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` from your LiveKit project.
4. Deploy. Every push to `main` redeploys automatically.

## Project structure

```
app/
  page.tsx                Home: create or join a room
  host/[code]/page.tsx    Host dashboard
  room/[code]/page.tsx    Participant page
  api/rooms/route.ts      Creates a room code and host key
  api/rooms/end/route.ts        Ends a session for everyone (host only)
  api/rooms/remove/route.ts     Removes one participant (host only)
  api/rooms/spotlight/route.ts  Shows one screen to everyone (host only)
  api/token/route.ts      Issues LiveKit access tokens with role permissions
components/
  HostDashboard.tsx       Grid, search, pins, alerts, full-size view, end session
  host/                   Screen tile and menu, people panel, dialogs, toasts
  ParticipantView.tsx     Join form and screen share controls
  InvitePanel.tsx         Room code and join link
  Logo.tsx                Logo mark and wordmark
lib/
  brand.ts                App name (change it here)
  livekit-server.ts       Server-only helpers (room codes, host keys)
  api.ts                  Client helpers
  attendance.ts           Attendance tracking and CSV export
  room-state.ts           Host identity and room metadata (who is shown to everyone)
```

## Roadmap

- Live stats panel (latency and quality per screen)
- Load testing with simulated participants up to 200
- Mobile app for screen sharing from phones
