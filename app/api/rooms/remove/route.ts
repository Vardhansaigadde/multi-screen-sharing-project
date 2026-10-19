import { authorizeHost, isNotFound } from "@/lib/livekit-server";
import { HOST_IDENTITY } from "@/lib/room-state";

// Removes one participant from the room. Their app shows "The host removed you".
export async function POST(request: Request) {
  const auth = await authorizeHost(request);
  if (auth instanceof Response) return auth;

  const { identity } = auth.body;
  if (typeof identity !== "string" || !identity || identity === HOST_IDENTITY) {
    return Response.json({ error: "Invalid participant" }, { status: 400 });
  }

  try {
    await auth.client.removeParticipant(auth.room, identity);
  } catch (err) {
    // Already gone counts as removed.
    if (!isNotFound(err)) {
      console.error(err);
      return Response.json({ error: "Couldn't remove this person. Try again." }, { status: 502 });
    }
  }

  return Response.json({ removed: true });
}
