import { generateRoomCode, hostKeyFor } from "@/lib/livekit-server";

// Creates a new room code and the secret key that lets its creator act as host.
export async function POST() {
  try {
    const code = generateRoomCode();
    return Response.json({ code, hostKey: hostKeyFor(code) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Server is not configured" }, { status: 500 });
  }
}
