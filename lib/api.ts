export type Role = "host" | "participant";

export type TokenResponse = { token: string; url: string };

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "Something went wrong");
  }
  return data as T;
}

export function createRoom() {
  return postJson<{ code: string; hostKey: string }>("/api/rooms");
}

export function fetchToken(params: {
  room: string;
  role: Role;
  name?: string;
  hostKey?: string;
}) {
  return postJson<TokenResponse>("/api/token", params);
}

export function connectionErrorMessage(err: Error) {
  if (/signal connection|Failed to fetch|websocket/i.test(err.message)) {
    return "Can't reach the video server. Make sure LiveKit is running and LIVEKIT_URL in .env.local is correct.";
  }
  return err.message;
}

export function normalizeRoomCode(input: string) {
  return input.replace(/[^a-z0-9]/gi, "").toUpperCase();
}
