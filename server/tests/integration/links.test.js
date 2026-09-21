/**
 * Share links: an owner turns one on, and someone with no account uses it to
 * talk to the avatar. The guest's call must land in the owner's history, and
 * the link must reveal and allow nothing beyond that.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { signIn, signUp, startTestApp } from "../helpers.js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../src/scripts/seed.js";

let app;
let demo;
let avatarId;

before(async () => {
  app = await startTestApp();
  demo = await signIn(app.baseUrl, { email: DEMO_EMAIL, password: DEMO_PASSWORD });
  avatarId = String(app.seeded.avatar._id);
});

after(() => app.stop());

/** Anonymous request - no bearer token, like a guest opening the link. */
async function anon(method, path, body) {
  const res = await fetch(`${app.baseUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function share(enabled) {
  const res = await fetch(`${app.baseUrl}/api/avatars/${avatarId}/share`, {
    method: "PUT",
    headers: { authorization: `Bearer ${demo.token}`, "content-type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  return { status: res.status, body: await res.json() };
}

describe("managing a link", () => {
  test("is off until turned on, and gets an unguessable token when it is", async () => {
    const before = await demo.get(`/api/avatars/${avatarId}/share`);
    assert.equal(before.status, 200);
    assert.deepEqual(before.body.share, { enabled: false, token: null });

    const on = await share(true);
    assert.equal(on.status, 200);
    assert.equal(on.body.share.enabled, true);
    assert.match(on.body.share.token, /^[A-Za-z0-9_-]{22}$/);
    assert.ok(!on.body.share.token.includes(avatarId), "never derived from the id");
  });

  test("turning it off and on keeps the same token, so sent invitations survive", async () => {
    const { token } = (await share(true)).body.share;
    await share(false);
    assert.equal((await share(true)).body.share.token, token);
  });

  test("resetting replaces the token and kills the old link", async () => {
    const old = (await share(true)).body.share.token;
    const reset = await demo.post(`/api/avatars/${avatarId}/share/reset`);
    assert.equal(reset.status, 200);
    assert.notEqual(reset.body.share.token, old);

    assert.equal((await anon("GET", `/api/links/${old}`)).status, 404);
    assert.equal((await anon("GET", `/api/links/${reset.body.share.token}`)).status, 200);
  });

  test("the avatar list carries the link state", async () => {
    await share(true);
    const { body } = await demo.get("/api/avatars");
    const avatar = body.avatars.find((a) => a._id === avatarId);
    assert.equal(avatar.share.enabled, true);
  });

  test("another workspace cannot read or change the link", async () => {
    const stranger = await signUp(app.baseUrl);
    assert.equal((await stranger.get(`/api/avatars/${avatarId}/share`)).status, 404);
    assert.equal((await stranger.post(`/api/avatars/${avatarId}/share/reset`)).status, 404);
  });
});

describe("using a link without an account", () => {
  test("shows only the avatar's name and picture", async () => {
    const { token } = (await share(true)).body.share;
    const { status, body } = await anon("GET", `/api/links/${token}`);

    assert.equal(status, 200);
    assert.equal(body.avatar.name, "Demo avatar");
    assert.equal(body.available, true);
    assert.deepEqual(Object.keys(body.avatar).sort(), ["name", "previewUrl"]);
  });

  test("a disabled or made-up link is not found", async () => {
    const { token } = (await share(true)).body.share;
    await share(false);
    assert.equal((await anon("GET", `/api/links/${token}`)).status, 404);
    assert.equal((await anon("GET", "/api/links/aaaaaaaaaaaaaaaaaaaaaa")).status, 404);
    assert.equal((await anon("GET", "/api/links/short")).status, 400);
  });

  test("a guest call starts, lands in the owner's history under the guest's name, and ends", async () => {
    const { token } = (await share(true)).body.share;

    const started = await anon("POST", `/api/links/${token}/calls`, {
      name: "Priya Sharma",
      email: "Priya@Example.com",
    });
    assert.equal(started.status, 201);
    assert.equal(started.body.transport, "livekit");
    assert.ok(started.body.token, "a LiveKit join token");
    assert.ok(started.body.callToken);

    // The LiveKit identity is a guest, not a user, and carries their name.
    const claims = JSON.parse(Buffer.from(started.body.token.split(".")[1], "base64url").toString());
    assert.match(claims.sub, /^guest-/);
    assert.equal(claims.name, "Priya Sharma");

    const { body: history } = await demo.get(`/api/conversations/${started.body.conversationId}`);
    assert.equal(history.conversation.source, "link");
    assert.equal(history.conversation.guest.name, "Priya Sharma");
    assert.equal(history.conversation.guest.email, "priya@example.com");

    const ended = await anon(
      "POST",
      `/api/links/${token}/calls/${started.body.conversationId}/end`,
      { callToken: started.body.callToken },
    );
    assert.equal(ended.status, 200);
    assert.deepEqual(ended.body, { ended: true }, "no costs or durations leak to guests");

    const { body: after } = await demo.get(`/api/conversations/${started.body.conversationId}`);
    assert.equal(after.conversation.status, "ended");
  });

  test("a guest must give a name", async () => {
    const { token } = (await share(true)).body.share;
    const res = await anon("POST", `/api/links/${token}/calls`, { name: "  " });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.details[0].message, "Please enter your name");
  });

  test("only the guest who started a call can end it", async () => {
    const { token } = (await share(true)).body.share;
    const started = await anon("POST", `/api/links/${token}/calls`, { name: "Sam" });
    const id = started.body.conversationId;

    const forged = await anon("POST", `/api/links/${token}/calls/${id}/end`, {
      callToken: "x".repeat(43),
    });
    assert.equal(forged.status, 404);

    // A real app call cannot be ended through a link either, even with a
    // correctly formed request.
    const appCall = await demo.post("/api/rooms", { avatarId });
    const crossed = await anon("POST", `/api/links/${token}/calls/${appCall.body.conversationId}/end`, {
      callToken: started.body.callToken,
    });
    assert.equal(crossed.status, 404);

    await anon("POST", `/api/links/${token}/calls/${id}/end`, { callToken: started.body.callToken });
    await demo.del(`/api/rooms/${appCall.body.conversationId}`);
  });

  test("a busy workspace turns a guest away without saying why", async () => {
    const { Workspace } = await import("../../src/models/index.js");
    await Workspace.updateOne(
      { _id: app.seeded.workspace._id },
      { $set: { "settings.concurrencyLimit": 1 } },
    );
    const { token } = (await share(true)).body.share;
    const first = await anon("POST", `/api/links/${token}/calls`, { name: "First" });

    const second = await anon("POST", `/api/links/${token}/calls`, { name: "Second" });
    assert.equal(second.status, 503);
    assert.doesNotMatch(second.body.error.message, /limit|workspace|\d+ call/i);

    await anon("POST", `/api/links/${token}/calls/${first.body.conversationId}/end`, {
      callToken: first.body.callToken,
    });
    await Workspace.updateOne(
      { _id: app.seeded.workspace._id },
      { $set: { "settings.concurrencyLimit": 3 } },
    );
  });
});

describe("finishing a call", () => {
  test("is idempotent across the API and the worker, and bills once", async () => {
    const { roomService } = await import("../../src/modules/rooms/room.service.js");
    const { UsageLedger } = await import("../../src/models/index.js");

    const started = await demo.post("/api/rooms", { avatarId });
    const id = started.body.conversationId;

    // The worker noticing the room close and the caller hanging up, at once.
    await Promise.all([
      roomService.finish(id, { endReason: "caller left" }),
      demo.del(`/api/rooms/${id}`),
      roomService.finish(id, { endReason: "room closed" }),
    ]);

    const entries = await UsageLedger.countDocuments({ conversationId: id, kind: "conversation" });
    assert.equal(entries, 1);

    const { body } = await demo.get(`/api/conversations/${id}`);
    assert.equal(body.conversation.status, "ended");
  });
});
