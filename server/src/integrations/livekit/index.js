import { AccessToken, RoomAgentDispatch, RoomConfiguration, RoomServiceClient } from "livekit-server-sdk";
import { env } from "../../config/env.js";

/**
 * LiveKit access is funnelled through here so no module outside this file ever
 * touches LIVEKIT_API_SECRET. The secret must never reach the browser - the
 * client only ever receives a signed, short-lived token.
 *
 * Works against LiveKit Cloud or the self-hosted server in docker-compose.
 * The dev container uses the well-known devkey/secret pair, which is why the
 * defaults below exist: a fresh clone connects with no account.
 */

const DEV_DEFAULTS = {
  url: "ws://localhost:7880",
  apiKey: "devkey",
  apiSecret: "secret",
};

export function livekitConfig() {
  return {
    url: env.livekit.url || DEV_DEFAULTS.url,
    apiKey: env.livekit.apiKey || DEV_DEFAULTS.apiKey,
    apiSecret: env.livekit.apiSecret || DEV_DEFAULTS.apiSecret,
    agentName: env.livekit.agentName,
    /** True when running against the local dev container rather than Cloud. */
    isDev: !env.livekit.apiKey,
  };
}

/**
 * Mint a join token and ask LiveKit to dispatch our agent into the same room.
 *
 * The dispatch is what makes the avatar show up: without it the participant
 * joins an empty room and waits forever.
 *
 * @param {{ roomName: string, identity: string, name?: string, metadata?: object }} input
 */
export async function createJoinToken({ roomName, identity, name, metadata = {} }) {
  const cfg = livekitConfig();
  const metadataJson = JSON.stringify(metadata);

  const at = new AccessToken(cfg.apiKey, cfg.apiSecret, {
    identity,
    name: name || identity,
    ttl: "1h",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  at.roomConfig = new RoomConfiguration({
    metadata: metadataJson,
    agents: [new RoomAgentDispatch({ agentName: cfg.agentName, metadata: metadataJson })],
  });

  return {
    token: await at.toJwt(),
    serverUrl: cfg.url,
    room: roomName,
    agentName: cfg.agentName,
  };
}

let roomService;

/** Admin client, for ending calls and reading room state. */
export function getRoomService() {
  if (!roomService) {
    const cfg = livekitConfig();
    // RoomServiceClient speaks HTTP; the token URL is a websocket URL.
    const httpUrl = cfg.url.replace(/^ws/, "http");
    roomService = new RoomServiceClient(httpUrl, cfg.apiKey, cfg.apiSecret);
  }
  return roomService;
}

export async function endRoom(roomName) {
  await getRoomService().deleteRoom(roomName);
}
