/**
 * End-to-end call smoke test.
 *
 * Joins a real LiveKit room as a headless participant and reports what the
 * agent actually does: whether it was dispatched, whether it published video,
 * and whether audio followed. This is the one path that unit and integration
 * tests cannot cover, because it needs a live LiveKit server and a running
 * worker.
 *
 *   npm --prefix server run smoke
 *
 * Requires the API and the agent worker to be running.
 */
import { RoomEvent, Room } from "@livekit/rtc-node";
import { env } from "../config/env.js";

const API = `http://localhost:${env.port}`;
const EMAIL = process.env.SMOKE_EMAIL || "demo@example.com";
const PASSWORD = process.env.SMOKE_PASSWORD || "demo-password-123";
const WAIT_MS = Number(process.env.SMOKE_WAIT_MS || 45_000);

const log = (...args) => console.log(" ", ...args);

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error?.message || `${path} failed (${res.status})`);
  return payload;
}

const session = await api("/api/auth/login", {
  method: "POST",
  body: { email: EMAIL, password: PASSWORD },
});
log("signed in as", session.user.email);

const { avatars } = await api("/api/avatars", { token: session.accessToken });
const avatar = avatars.find((a) => a.callable);
if (!avatar) throw new Error("No callable avatar. Run: npm --prefix server run seed");
log("avatar:", avatar.name, `(${avatar.providerId})`);

const call = await api("/api/rooms", {
  method: "POST",
  token: session.accessToken,
  body: { avatarId: avatar._id },
});
log("room:", call.room);
log("dispatching to agent:", call.agentName);

const room = new Room();

const seen = {
  agentJoined: false,
  videoTrack: false,
  audioTrack: false,
  frames: 0,
};

room.on(RoomEvent.ParticipantConnected, (participant) => {
  seen.agentJoined = true;
  log("participant joined:", participant.identity, `(kind ${participant.kind})`);
});

room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  const kind = publication.kind === 2 || track.kind === 2 ? "video" : "audio";
  if (kind === "video") seen.videoTrack = true;
  else seen.audioTrack = true;
  log(`subscribed to ${kind} from ${participant.identity}`);
});

await room.connect(call.url, call.token, { autoSubscribe: true, dynacast: false });
log("connected to room");

// Give LiveKit time to dispatch, the worker to resolve the job, and the
// renderer to publish its first frame.
const deadline = Date.now() + WAIT_MS;
while (Date.now() < deadline && !(seen.videoTrack && seen.agentJoined)) {
  await new Promise((r) => setTimeout(r, 500));
}

log("");
log("agent dispatched  :", seen.agentJoined ? "yes" : "NO");
log("video published   :", seen.videoTrack ? "yes" : "NO");
log("audio published   :", seen.audioTrack ? "yes" : "no (expected until it speaks)");
log("remote participants:", room.remoteParticipants.size);

await room.disconnect();
await api(`/api/rooms/${call.conversationId}`, {
  method: "DELETE",
  token: session.accessToken,
}).catch(() => {});

const ok = seen.agentJoined && seen.videoTrack;
log("");
log(ok ? "PASS - the avatar joined and published video" : "FAIL - see the worker logs");
process.exit(ok ? 0 : 1);
