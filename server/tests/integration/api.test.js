/**
 * Health, auth, tenancy, avatars and the call path - against the real app and
 * real models, with only the database swapped out.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { signIn, signUp, startTestApp } from "../helpers.js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../src/scripts/seed.js";

let app;
let demo;
let seeded;

before(async () => {
  app = await startTestApp();
  seeded = app.seeded;
  demo = await signIn(app.baseUrl, { email: DEMO_EMAIL, password: DEMO_PASSWORD });
});

after(() => app.stop());

describe("health", () => {
  test("reports what this instance can actually do", async () => {
    const res = await fetch(`${app.baseUrl}/api/health`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(body.implementedProviders.sort(), ["lemonslice", "mock", "mock-hosted"]);
    assert.equal(body.livekit.mode, "self-hosted-dev");
    assert.equal(body.storage.driver, "local");
  });
});

describe("auth", () => {
  test("rejects an unauthenticated request", async () => {
    const res = await fetch(`${app.baseUrl}/api/avatars`);
    assert.equal(res.status, 401);
  });

  test("rejects a garbage token", async () => {
    const res = await fetch(`${app.baseUrl}/api/avatars`, {
      headers: { authorization: "Bearer not-a-jwt" },
    });
    assert.equal(res.status, 401);
  });

  test("registering creates a workspace and returns both tokens", async () => {
    const account = await signUp(app.baseUrl);

    assert.ok(account.accessToken);
    assert.ok(account.refreshToken);
    assert.ok(account.workspace._id);
    assert.equal(account.user.role, "owner");
    // The hash must never leave the server.
    assert.equal(account.user.passwordHash, undefined);
  });

  test("a duplicate email does not reveal that the account exists", async () => {
    const res = await fetch(`${app.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: DEMO_EMAIL, password: "another-password-123" }),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.doesNotMatch(body.error.message, /already|exists|registered|taken/i);
  });

  test("a wrong password is refused", async () => {
    const res = await fetch(`${app.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: DEMO_EMAIL, password: "wrong-password-here" }),
    });
    assert.equal(res.status, 401);
  });

  test("a refresh token mints a new access token", async () => {
    const account = await signUp(app.baseUrl);
    const res = await fetch(`${app.baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: account.refreshToken }),
    });

    assert.equal(res.status, 200);
    assert.ok((await res.json()).accessToken);
  });

  test("logging out invalidates outstanding refresh tokens", async () => {
    const account = await signUp(app.baseUrl);

    const out = await account.post("/api/auth/logout");
    assert.equal(out.status, 200);

    const res = await fetch(`${app.baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: account.refreshToken }),
    });
    assert.equal(res.status, 401, "the old refresh token must be dead");
  });
});

describe("tenancy", () => {
  test("a fresh workspace cannot see another one's avatars", async () => {
    const stranger = await signUp(app.baseUrl);

    const mine = await stranger.get("/api/avatars");
    assert.equal(mine.status, 200);
    assert.equal(mine.body.avatars.length, 0, "a fresh workspace starts empty");

    // The seeded avatar exists, but not for this caller.
    const direct = await stranger.get(`/api/avatars/${seeded.avatar._id}`);
    assert.equal(direct.status, 404);
  });

  test("a stranger cannot call another workspace's avatar", async () => {
    const stranger = await signUp(app.baseUrl);
    const res = await stranger.post("/api/rooms", { avatarId: String(seeded.avatar._id) });
    assert.equal(res.status, 404);
  });
});

describe("avatars", () => {
  test("lists the seeded avatar with vendor capabilities attached", async () => {
    const { status, body } = await demo.get("/api/avatars");
    assert.equal(status, 200);

    const avatar = body.avatars.find((a) => a.name === "Demo avatar");
    assert.ok(avatar);
    assert.equal(avatar.status, "ready");
    assert.equal(avatar.capabilities.pipelineMode, "render-only");
    assert.equal(avatar.callable, true);
  });

  test("rejects a malformed id before reaching the database", async () => {
    const { status, body } = await demo.get("/api/avatars/not-an-id");
    assert.equal(status, 400);
    assert.equal(body.error.message, "Validation failed");
  });

  test("404s an id that is well formed but absent", async () => {
    const { status } = await demo.get(`/api/avatars/${new mongoose.Types.ObjectId()}`);
    assert.equal(status, 404);
  });
});

describe("rooms", () => {
  test("starting a call returns a livekit connection and records the conversation", async () => {
    const { status, body } = await demo.post("/api/rooms", {
      avatarId: String(seeded.avatar._id),
    });

    assert.equal(status, 201);
    assert.equal(body.transport, "livekit");
    assert.match(body.room, /^call-/);
    assert.ok(body.token);
    assert.ok(body.url.startsWith("ws://"));

    const { Conversation } = await import("../../src/models/index.js");
    const convo = await Conversation.findById(body.conversationId).lean();
    assert.equal(convo.pipelineMode, "render-only");
    assert.equal(convo.status, "pending");

    await demo.del(`/api/rooms/${body.conversationId}`);
  });

  test("the join token carries the room grant and agent dispatch", async () => {
    const { body } = await demo.post("/api/rooms", { avatarId: String(seeded.avatar._id) });

    const claims = JSON.parse(Buffer.from(body.token.split(".")[1], "base64url").toString());
    assert.equal(claims.video.room, body.room);
    assert.equal(claims.video.roomJoin, true);
    // Without the dispatch the caller joins an empty room and waits forever.
    assert.equal(claims.roomConfig.agents[0].agentName, body.agentName);

    await demo.del(`/api/rooms/${body.conversationId}`);
  });

  test("refuses to call an avatar that is not ready", async () => {
    const { Avatar } = await import("../../src/models/index.js");
    const draft = await Avatar.create({
      workspaceId: seeded.workspace._id,
      name: "Still training",
      sourceType: "video",
      status: "training",
      providerId: "mock",
    });

    const { status, body } = await demo.post("/api/rooms", { avatarId: String(draft._id) });
    assert.equal(status, 409);
    assert.match(body.error.message, /not ready/);
  });

  test("ending a call marks it ended and meters the usage", async () => {
    const started = await demo.post("/api/rooms", { avatarId: String(seeded.avatar._id) });
    const { status, body } = await demo.del(`/api/rooms/${started.body.conversationId}`);

    assert.equal(status, 200);
    assert.equal(typeof body.minutes, "number");
    assert.equal(typeof body.costCents, "number");

    const { Conversation, UsageLedger } = await import("../../src/models/index.js");
    const convo = await Conversation.findById(started.body.conversationId).lean();
    assert.equal(convo.status, "ended");

    const entries = await UsageLedger.find({ conversationId: convo._id }).lean();
    assert.equal(entries.length, 1, "exactly one ledger entry per conversation");
  });

  test("ending twice does not double-bill", async () => {
    const started = await demo.post("/api/rooms", { avatarId: String(seeded.avatar._id) });
    await demo.del(`/api/rooms/${started.body.conversationId}`);
    await demo.del(`/api/rooms/${started.body.conversationId}`);

    const { UsageLedger } = await import("../../src/models/index.js");
    const entries = await UsageLedger.find({
      conversationId: new mongoose.Types.ObjectId(started.body.conversationId),
    }).lean();
    assert.equal(entries.length, 1, "the ledger is append-only but not duplicated");
  });

  test("enforces the workspace concurrency limit", async () => {
    const { Workspace } = await import("../../src/models/index.js");
    await Workspace.updateOne(
      { _id: seeded.workspace._id },
      { $set: { "settings.concurrencyLimit": 2 } },
    );

    const open = [];
    for (let i = 0; i < 2; i += 1) {
      const res = await demo.post("/api/rooms", { avatarId: String(seeded.avatar._id) });
      assert.equal(res.status, 201);
      open.push(res.body.conversationId);
    }

    const refused = await demo.post("/api/rooms", { avatarId: String(seeded.avatar._id) });
    assert.equal(refused.status, 429);
    assert.match(refused.body.error.message, /limit is 2/);

    // Freeing a slot lets the next call through, so the limit is a gate rather
    // than a one-way latch.
    await demo.del(`/api/rooms/${open[0]}`);
    const allowed = await demo.post("/api/rooms", { avatarId: String(seeded.avatar._id) });
    assert.equal(allowed.status, 201);

    for (const id of [...open.slice(1), allowed.body.conversationId]) {
      await demo.del(`/api/rooms/${id}`);
    }
  });
});

describe("usage reporting", () => {
  test("summarises the period by provider", async () => {
    const { status, body } = await demo.get("/api/analytics/usage");

    assert.equal(status, 200);
    assert.ok(body.periodStart);
    assert.equal(typeof body.totals.minutes, "number");
    assert.ok(Array.isArray(body.byProvider));
    // Everything so far has gone through the mock provider.
    assert.ok(body.byProvider.every((p) => p.providerId === "mock"));
  });
});
