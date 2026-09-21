/**
 * Call history: the worker's transcript recorder writes, the conversations API
 * reads. Exercised end to end against the real app, with the recorder fed the
 * same shape of message the agents framework emits.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { signIn, signUp, startTestApp } from "../helpers.js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../src/scripts/seed.js";
import { createTranscriptRecorder, toTurn } from "../../src/agent/transcript.recorder.js";

let app;
let demo;

before(async () => {
  app = await startTestApp();
  demo = await signIn(app.baseUrl, { email: DEMO_EMAIL, password: DEMO_PASSWORD });
});

after(() => app.stop());

/** A ChatMessage stand-in: the recorder only reads these fields. */
const message = (role, textContent, extra = {}) => ({
  role,
  textContent,
  createdAt: Date.now(),
  ...extra,
});

/** Starts and ends a real call, returning its conversation id. */
async function makeCall() {
  const started = await demo.post("/api/rooms", { avatarId: String(app.seeded.avatar._id) });
  assert.equal(started.status, 201);
  return started.body.conversationId;
}

async function recordInto(conversationId, items) {
  const recorder = createTranscriptRecorder({
    conversationId: new mongoose.Types.ObjectId(conversationId),
    workspaceId: app.seeded.workspace._id,
  });
  for (const item of items) recorder.record(item);
  await recorder.flush();
}

describe("transcript recorder", () => {
  test("keeps only what the caller and the avatar said", () => {
    assert.equal(toTurn(message("system", "You are a helpful avatar.")), null);
    assert.equal(toTurn(message("developer", "tool output")), null);
    assert.equal(toTurn(message("user", "   ")), null, "an empty turn is noise");
    assert.equal(toTurn(message("user", undefined)), null);
    assert.equal(toTurn({ type: "agent_handoff" }), null);

    const turn = toTurn(message("assistant", " Hi there ", { interrupted: true }));
    assert.equal(turn.text, "Hi there");
    assert.equal(turn.interrupted, true);
  });

  test("writes turns in the order they were spoken", async () => {
    const id = await makeCall();
    const lines = Array.from({ length: 12 }, (_, i) =>
      message(i % 2 ? "assistant" : "user", `line ${i}`),
    );

    await recordInto(id, lines);

    const { body } = await demo.get(`/api/conversations/${id}`);
    assert.deepEqual(
      body.transcript.turns.map((t) => t.text),
      lines.map((l) => l.textContent),
    );
    await demo.del(`/api/rooms/${id}`);
  });
});

describe("conversations api", () => {
  test("lists calls newest first with a turn count and the caller's first line", async () => {
    const older = await makeCall();
    const newer = await makeCall();
    await recordInto(newer, [
      message("assistant", "Hi, what can I help you with?"),
      message("user", "Can you explain pricing?"),
      message("assistant", "Sure - there are two plans.", { interrupted: true }),
      message("system", "ignored"),
    ]);
    await demo.del(`/api/rooms/${older}`);
    await demo.del(`/api/rooms/${newer}`);

    const { status, body } = await demo.get("/api/conversations");
    assert.equal(status, 200);

    const ids = body.conversations.map((c) => c._id);
    assert.ok(ids.indexOf(newer) < ids.indexOf(older), "newest first");

    const listed = body.conversations.find((c) => c._id === newer);
    assert.equal(listed.turnCount, 3);
    assert.equal(listed.preview, "Can you explain pricing?");
    assert.equal(listed.avatar.name, "Demo avatar");
    assert.equal(listed.status, "ended");

    const silent = body.conversations.find((c) => c._id === older);
    assert.equal(silent.turnCount, 0);
    assert.equal(silent.preview, null);
  });

  test("returns the full transcript for one call", async () => {
    const id = await makeCall();
    await recordInto(id, [message("user", "Hello?"), message("assistant", "Hi!")]);

    const { status, body } = await demo.get(`/api/conversations/${id}`);
    assert.equal(status, 200);
    assert.equal(body.conversation._id, id);
    assert.deepEqual(
      body.transcript.turns.map(({ role, text }) => ({ role, text })),
      [
        { role: "user", text: "Hello?" },
        { role: "assistant", text: "Hi!" },
      ],
    );
    assert.equal(typeof body.transcript.turns[0].tsMs, "number");
    await demo.del(`/api/rooms/${id}`);
  });

  test("a call where nothing was said has no transcript rather than an empty one", async () => {
    const id = await makeCall();
    const { body } = await demo.get(`/api/conversations/${id}`);
    assert.equal(body.transcript, null);
    await demo.del(`/api/rooms/${id}`);
  });

  test("keeps the history after the avatar is deleted", async () => {
    const { Avatar } = await import("../../src/models/index.js");
    const doomed = await Avatar.create({
      workspaceId: app.seeded.workspace._id,
      name: "Short-lived",
      sourceType: "photo",
      status: "ready",
      providerId: "mock",
    });
    const started = await demo.post("/api/rooms", { avatarId: String(doomed._id) });
    await recordInto(started.body.conversationId, [message("user", "Still here?")]);
    await demo.del(`/api/rooms/${started.body.conversationId}`);
    await demo.del(`/api/avatars/${doomed._id}`);

    const { status, body } = await demo.get(`/api/conversations/${started.body.conversationId}`);
    assert.equal(status, 200);
    assert.equal(body.conversation.avatar, null);
    assert.equal(body.transcript.turns[0].text, "Still here?");
  });

  test("another workspace can neither list nor open these calls", async () => {
    const id = await makeCall();
    await recordInto(id, [message("user", "private")]);
    await demo.del(`/api/rooms/${id}`);

    const stranger = await signUp(app.baseUrl);
    const list = await stranger.get("/api/conversations");
    assert.equal(list.status, 200);
    assert.equal(list.body.conversations.length, 0);

    const direct = await stranger.get(`/api/conversations/${id}`);
    assert.equal(direct.status, 404);
  });

  test("rejects a malformed id and an unauthenticated caller", async () => {
    assert.equal((await demo.get("/api/conversations/not-an-id")).status, 400);
    assert.equal((await fetch(`${app.baseUrl}/api/conversations`)).status, 401);
  });
});
