import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

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
