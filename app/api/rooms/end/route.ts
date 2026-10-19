import { authorizeHost, isNotFound } from "@/lib/livekit-server";

// Ends a session for everyone. Deleting the room in LiveKit disconnects every
// participant immediately, which also stops their screen sharing.
export async function POST(request: Request) {
  const auth = await authorizeHost(request);
  if (auth instanceof Response) return auth;

  try {
    await auth.client.deleteRoom(auth.room);
  } catch (err) {
    // A room nobody has joined yet doesn't exist in LiveKit, so it's already ended.
    if (!isNotFound(err)) {
      console.error(err);
      return Response.json({ error: "Couldn't end the session. Try again." }, { status: 502 });
    }
  }

  return Response.json({ ended: true });
}
