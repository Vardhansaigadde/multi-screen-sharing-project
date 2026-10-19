// Shared between server and browser: who the host is, and what the room
// metadata looks like.

// Every host connects with this identity, so participants know whose
// subscriptions to allow. A second host tab replaces the first one.
export const HOST_IDENTITY = "host";

export type RoomState = {
  // Identity of the participant whose screen the host is showing to everyone.
  spotlight: string | null;
};

export function parseRoomState(metadata: string | undefined): RoomState {
  try {
    const parsed = JSON.parse(metadata || "{}");
    return { spotlight: typeof parsed.spotlight === "string" ? parsed.spotlight : null };
  } catch {
    return { spotlight: null };
  }
}
