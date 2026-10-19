import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { RoomServiceClient } from "livekit-server-sdk";

// Server-only helpers. Never import this file from a client component:
// it reads the LiveKit API secret.

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const ROOM_CODE_LENGTH = 6;

export function getLiveKitConfig() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    throw new Error(
      "Missing LIVEKIT_URL, LIVEKIT_API_KEY or LIVEKIT_API_SECRET in .env.local",
    );
  }
  return { url, apiKey, apiSecret };
}

export function generateRoomCode() {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function isValidRoomCode(code: unknown): code is string {
  return (
    typeof code === "string" &&
    new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`).test(code)
  );
}

// The host key proves someone created the room. It is derived from the room
// code and the API secret, so no database is needed to check it.
export function hostKeyFor(code: string) {
  const { apiSecret } = getLiveKitConfig();
  return createHmac("sha256", apiSecret)
    .update(`host:${code}`)
    .digest("hex")
    .slice(0, 24);
}

export function isValidHostKey(code: string, key: unknown) {
  if (typeof key !== "string") return false;
  const expected = Buffer.from(hostKeyFor(code));
  const given = Buffer.from(key);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// When LIVEKIT_URL points at localhost, devices on the same Wi-Fi need the
// server's LAN address instead, so swap in the hostname they used to reach us.
export function publicLiveKitUrl(configuredUrl: string, requestHost: string | null) {
  const url = new URL(configuredUrl);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (isLocal && requestHost) {
    url.hostname = requestHost.split(":")[0];
  }
  return url.toString().replace(/\/$/, "");
}

type HostRequest = {
  room: string;
  body: Record<string, unknown>;
  client: RoomServiceClient;
};

// Shared checks for host-only actions: valid JSON, a valid room code, and the
// host key that proves the caller created the room. Returns either the parsed
// request or an error Response to send back.
export async function authorizeHost(request: Request): Promise<HostRequest | Response> {
  let body: Record<string, unknown>;
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
    return Response.json({ error: "Only the host can do this" }, { status: 403 });
  }

  // The room service API speaks HTTP, while LIVEKIT_URL is a WebSocket URL.
  const apiUrl = config.url.replace(/^ws/, "http");
  return { room, body, client: new RoomServiceClient(apiUrl, config.apiKey, config.apiSecret) };
}

export function isNotFound(err: unknown) {
  return (err as { status?: number }).status === 404;
}
