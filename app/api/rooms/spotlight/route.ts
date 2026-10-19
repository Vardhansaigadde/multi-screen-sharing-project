import { authorizeHost } from "@/lib/livekit-server";
import { HOST_IDENTITY, type RoomState } from "@/lib/room-state";

// Starts or stops showing one participant's screen to everyone. The choice is
// stored in the room metadata, which every connected app receives instantly.
export async function POST(request: Request) {
  const auth = await authorizeHost(request);
  if (auth instanceof Response) return auth;

  const { identity } = auth.body;
  if (identity !== null && (typeof identity !== "string" || identity === HOST_IDENTITY)) {
    return Response.json({ error: "Invalid participant" }, { status: 400 });
  }

  const state: RoomState = { spotlight: identity };
  try {
    await auth.client.updateRoomMetadata(auth.room, JSON.stringify(state));
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Couldn't update the room. Try again." }, { status: 502 });
  }

  return Response.json(state);
}
