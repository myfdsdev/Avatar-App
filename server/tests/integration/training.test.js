/**
 * Video-cloned avatars: the asynchronous training path and the webhook that
 * resolves it.
 *
 * Runs against the mock provider, whose training deliberately takes real time
 * so the queued -> running -> succeeded transition is genuinely exercised
 * rather than short-circuited.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { signIn, startTestApp } from "../helpers.js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../src/scripts/seed.js";

let app;
let demo;
let workspaceId;

const FAKE_VIDEO = Buffer.alloc(2048, 7);

before(async () => {
  app = await startTestApp();
  demo = await signIn(app.baseUrl, { email: DEMO_EMAIL, password: DEMO_PASSWORD });
  workspaceId = String(app.seeded.workspace._id);
});

after(async () => {
  await app.stop();
  await fs.rm(path.resolve("uploads", workspaceId), { recursive: true, force: true });
});

function uploadVideo({ name = "Cloned avatar", providerId } = {}) {
  const form = new FormData();
  form.append("name", name);
  if (providerId) form.append("providerId", providerId);
  form.append("video", new Blob([FAKE_VIDEO], { type: "video/mp4" }), "clip.mp4");
  return demo.upload("/api/studio/video", form);
}

const getAvatar = (id) => demo.get(`/api/avatars/${id}`);

describe("video training", () => {
  test("accepts the upload and returns a training avatar, not a ready one", async () => {
    const { status, body } = await uploadVideo();

    // 202, because the work is not done when the response is written.
    assert.equal(status, 202);
    assert.equal(body.avatar.status, "training");
    assert.equal(body.avatar.sourceType, "video");
    assert.ok(body.avatar.trainingJobId);

    const { TrainingJob } = await import("../../src/models/index.js");
    const job = await TrainingJob.findById(body.avatar.trainingJobId).lean();
    assert.ok(["queued", "running"].includes(job.status));
    assert.notEqual(job.providerJobId, "pending", "job should carry the vendor id");
  });

  test("a training avatar is not callable", async () => {
    const { body } = await uploadVideo({ name: "Not yet" });

    const avatar = await getAvatar(body.avatar._id);
    assert.equal(avatar.body.avatar.callable, false);

    const res = await demo.post("/api/rooms", { avatarId: body.avatar._id });
    assert.equal(res.status, 409);
  });

  test("rejects a non-video upload", async () => {
    const form = new FormData();
    form.append("name", "Bad");
    form.append("video", new Blob([Buffer.from("nope")], { type: "text/plain" }), "x.txt");

    const { status, body } = await demo.upload("/api/studio/video", form);
    assert.equal(status, 422);
    assert.match(body.error.message, /Unsupported video type/);
  });

  test("refuses lemonslice, which cannot clone from video", async () => {
    const { status, body } = await uploadVideo({ providerId: "lemonslice" });
    assert.equal(status, 422);
    assert.match(body.error.message, /createFromVideo/);
  });

  test("reading the avatar reconciles a finished job without any webhook", async () => {
    const { body } = await uploadVideo({ name: "Resolves on read" });
    const { TrainingJob } = await import("../../src/models/index.js");

    // Make the vendor report completion by backdating the job start.
    const { getProvider } = await import("../../src/avatar/providers/registry.js");
    const mock = getProvider("mock");
    const job = await TrainingJob.findById(body.avatar.trainingJobId).lean();
    mock.jobs.get(job.providerJobId).startedAt = Date.now() - 60_000;

    const settled = await getAvatar(body.avatar._id);
    assert.equal(
      settled.body.avatar.status,
      "ready",
      "read should have pulled the vendor status through",
    );
    assert.equal(settled.body.avatar.callable, true);
    assert.ok(settled.body.avatar.providerAvatarId);
  });
});

describe("webhook security", () => {
  test("a forged token does not match any job", async () => {
    const { body } = await uploadVideo({ name: "Forge target" });

    // Webhooks carry no bearer token - vendors authenticate by the signed URL.
    const res = await fetch(
      `${app.baseUrl}/api/webhooks/providers/mock/${body.avatar.trainingJobId}.deadbeefdeadbeefdeadbeefdeadbeef`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ face_id: "whatever", status: "ready" }),
      },
    );

    assert.equal(res.status, 200, "webhooks always 200 so vendors stop retrying");
    assert.equal((await res.json()).matched, false);

    // The forged "ready" must not have been written anywhere.
    const avatar = await getAvatar(body.avatar._id);
    assert.equal(avatar.body.avatar.status, "training");
  });

  test("a valid token matches, but the payload's status is still ignored", async () => {
    const { body } = await uploadVideo({ name: "Honest webhook" });
    const jobId = body.avatar.trainingJobId;

    const mac = crypto
      .createHmac("sha256", process.env.WEBHOOK_SECRET)
      .update(jobId)
      .digest("hex")
      .slice(0, 32);

    const res = await fetch(`${app.baseUrl}/api/webhooks/providers/mock/${jobId}.${mac}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Claims success while the vendor still says it is running.
      body: JSON.stringify({ face_id: "x", status: "ready" }),
    });

    assert.equal((await res.json()).matched, true);

    const avatar = await getAvatar(body.avatar._id);
    assert.equal(
      avatar.body.avatar.status,
      "training",
      "status must come from the vendor, never from the webhook body",
    );
  });
});
