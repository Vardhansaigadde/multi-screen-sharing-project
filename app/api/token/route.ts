import { randomBytes } from "node:crypto";
import { AccessToken, TrackSource, type VideoGrant } from "livekit-server-sdk";
import {
  getLiveKitConfig,
  isValidHostKey,
  isValidRoomCode,
  publicLiveKitUrl,
} from "@/lib/livekit-server";

type TokenRequest = {
  room?: unknown;
  name?: unknown;
  role?: unknown;
  hostKey?: unknown;
};

export async function POST(request: Request) {
  let body: TokenRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { room, role, hostKey } = body;
  if (!isValidRoomCode(room)) {
    return Response.json({ error: "Invalid room code" }, { status: 400 });
  }
  if (role !== "host" && role !== "participant") {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 32) : "";
  if (role === "participant" && !name) {
    return Response.json({ error: "Please enter your name" }, { status: 400 });
  }

  let config;
  try {
    config = getLiveKitConfig();
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Server is not configured" }, { status: 500 });
  }

  if (role === "host" && !isValidHostKey(room, hostKey)) {
    return Response.json({ error: "Invalid host link" }, { status: 403 });
  }

  // Permissions are enforced by the LiveKit server itself:
  // - the host can watch every screen but publishes nothing and stays hidden
  // - participants can only share their screen and cannot watch anyone
  const grant: VideoGrant =
    role === "host"
      ? {
          room,
          roomJoin: true,
          roomAdmin: true,
          canSubscribe: true,
          canPublish: false,
          canPublishData: false,
          hidden: true,
        }
      : {
          room,
          roomJoin: true,
          canSubscribe: false,
          canPublish: true,
          canPublishSources: [TrackSource.SCREEN_SHARE],
          canPublishData: false,
        };

  const identity = `${role}-${randomBytes(4).toString("hex")}`;
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity,
    name: role === "host" ? "Host" : name,
    ttl: "6h",
  });
  token.addGrant(grant);

  return Response.json({
    token: await token.toJwt(),
    url: publicLiveKitUrl(config.url, request.headers.get("host")),
  });
}
