/**
 * The full-pipeline branch: vendor-hosted sessions on a non-LiveKit transport.
 *
 * Exercised through `mock-hosted` rather than Tavus, so the path that costs
 * money in production costs nothing to keep honest here.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { signIn, startTestApp } from "../helpers.js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../src/scripts/seed.js";

let app;
let demo;
let hostedAvatar;

before(async () => {
  app = await startTestApp();
  demo = await signIn(app.baseUrl, { email: DEMO_EMAIL, password: DEMO_PASSWORD });

  const { Avatar } = await import("../../src/models/index.js");
  hostedAvatar = await Avatar.create({
    workspaceId: app.seeded.workspace._id,
    name: "Hosted avatar",
    sourceType: "video",
    status: "ready",
    providerId: "mock-hosted",
    providerAvatarId: "mock_face_1",
  });
});

after(() => app.stop());

describe("full-pipeline calls", () => {
  test("returns the vendor's own transport rather than a LiveKit room", async () => {
    const { status, body } = await demo.post("/api/rooms", {
      avatarId: String(hostedAvatar._id),
    });

    assert.equal(status, 201);
    assert.equal(body.transport, "daily");
    assert.match(body.url, /^https:\/\//, "expected a join URL, not a websocket");

    const { Conversation } = await import("../../src/models/index.js");
    const convo = await Conversation.findById(body.conversationId).lean();
    assert.equal(convo.pipelineMode, "full-pipeline");
    assert.ok(convo.providerSessionId, "the vendor session id must be stored");

    await demo.del(`/api/rooms/${body.conversationId}`);
  });

  test("starts the billing clock at session creation, not on agent join", async () => {
    const { body } = await demo.post("/api/rooms", { avatarId: String(hostedAvatar._id) });

    const { Conversation } = await import("../../src/models/index.js");
    const convo = await Conversation.findById(body.conversationId).lean();

    // No agent worker runs for these, so nothing else would ever set this -
    // and the vendor is already charging.
    assert.equal(convo.status, "active");
    assert.ok(convo.startedAt, "startedAt must be set when the session is created");

    await demo.del(`/api/rooms/${body.conversationId}`);
  });

  test("a hosted call meters a non-zero duration", async () => {
    const { body } = await demo.post("/api/rooms", { avatarId: String(hostedAvatar._id) });

    await new Promise((r) => setTimeout(r, 1100));
    const ended = await demo.del(`/api/rooms/${body.conversationId}`);

    assert.equal(ended.status, 200);
    assert.ok(ended.body.durationSec >= 1, `expected at least 1s, got ${ended.body.durationSec}`);

    const { UsageLedger } = await import("../../src/models/index.js");
    const entries = await UsageLedger.find({ conversationId: convoId(body) }).lean();
    assert.equal(entries.length, 1);
    assert.ok(entries[0].minutes > 0, "a hosted call must not meter as zero minutes");
  });
});

function convoId(body) {
  return body.conversationId;
}
