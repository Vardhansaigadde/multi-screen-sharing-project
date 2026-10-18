import { RoomServiceClient } from "livekit-server-sdk";
import { getLiveKitConfig, isValidHostKey, isValidRoomCode } from "@/lib/livekit-server";

// Ends a session for everyone. Deleting the room in LiveKit disconnects every
// participant immediately, which also stops their screen sharing.
export async function POST(request: Request) {
  let body: { room?: unknown; hostKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { room, hostKey } = body;
  if (!isValidRoomCode(room)) {
    return Response.json({ error: "Invalid room code" }, { status: 400 });
  }

  let config;
  try {
    config = getLiveKitConfig();
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Server is not configured" }, { status: 500 });
  }

  if (!isValidHostKey(room, hostKey)) {
    return Response.json({ error: "Only the host can end this session" }, { status: 403 });
  }

  // The room service API speaks HTTP, while LIVEKIT_URL is a WebSocket URL.
  const apiUrl = config.url.replace(/^ws/, "http");
  const client = new RoomServiceClient(apiUrl, config.apiKey, config.apiSecret);

  try {
    await client.deleteRoom(room);
  } catch (err) {
    // A room nobody has joined yet doesn't exist in LiveKit, so it's already ended.
    const status = (err as { status?: number }).status;
    if (status !== 404) {
      console.error(err);
      return Response.json({ error: "Couldn't end the session. Try again." }, { status: 502 });
    }
  }

  return Response.json({ ended: true });
}
