/**
 * Photo avatar creation, against the real app and an in-memory database.
 *
 * Uploads go through the local storage driver, so files land in ./uploads and
 * are cleaned up afterwards.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { signIn, startTestApp } from "../helpers.js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../src/scripts/seed.js";

let app;
let demo;
let workspaceId;

// Smallest valid PNG: a single transparent pixel.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

before(async () => {
  app = await startTestApp();
  demo = await signIn(app.baseUrl, { email: DEMO_EMAIL, password: DEMO_PASSWORD });
  workspaceId = String(app.seeded.workspace._id);
});

after(async () => {
  await app.stop();
  await fs.rm(path.resolve("uploads", workspaceId), { recursive: true, force: true });
});

function uploadPhoto({
  name = "Test avatar",
  providerId,
  buffer = PNG_1PX,
  type = "image/png",
  filename = "face.png",
} = {}) {
  const form = new FormData();
  form.append("name", name);
  if (providerId) form.append("providerId", providerId);
  form.append("image", new Blob([buffer], { type }), filename);
  return demo.upload("/api/studio/photo", form);
}

describe("studio options", () => {
  test("reports the storage driver and which vendors it can actually serve", async () => {
    const { body } = await demo.get("/api/studio/options");

    assert.equal(body.storage.driver, "local");
    // Local URLs are localhost, which real vendors cannot fetch.
    assert.equal(body.storage.reachableByVendors, false);

    const byId = Object.fromEntries(body.providers.map((p) => [p.id, p]));
    assert.equal(byId.mock.usable, true);

    // LemonSlice takes the bytes directly, so local storage is no obstacle -
    // it is unusable here only because no API key is set.
    assert.equal(byId.lemonslice.acceptsDirectUpload, true);
    assert.equal(byId.lemonslice.configured, false);
    assert.equal(byId.lemonslice.usable, false);

    // Tavus is configured but fetches assets itself, so it needs public storage.
    assert.equal(byId.tavus.configured, true);
    assert.equal(byId.tavus.acceptsDirectUpload, false);
    assert.equal(byId.tavus.usable, false);
    assert.equal(byId.tavus.videoClone, true);
  });

  test("requires authentication", async () => {
    const res = await fetch(`${app.baseUrl}/api/studio/options`);
    assert.equal(res.status, 401);
  });
});

describe("photo upload", () => {
  test("creates a ready avatar and stores the asset", async () => {
    const { status, body } = await uploadPhoto({ name: "Uploaded avatar" });

    assert.equal(status, 201);
    assert.equal(body.avatar.name, "Uploaded avatar");
    assert.equal(body.avatar.status, "ready");
    assert.equal(body.avatar.sourceType, "photo");
    assert.equal(body.avatar.providerId, "mock");
    assert.ok(body.avatar.previewUrl.includes("/uploads/"));

    const { AvatarAsset } = await import("../../src/models/index.js");
    const asset = await AvatarAsset.findById(body.avatar.assetId).lean();
    assert.equal(asset.kind, "image");
    assert.equal(asset.mime, "image/png");
    assert.ok(asset.checksum, "expected a content checksum");

    // The file really landed where the URL claims.
    await fs.access(path.resolve("uploads", asset.storageKey));
  });

  test("the new avatar is immediately callable", async () => {
    const created = await uploadPhoto({ name: "Callable avatar" });
    const res = await demo.post("/api/rooms", { avatarId: created.body.avatar._id });

    assert.equal(res.status, 201);
    await demo.del(`/api/rooms/${res.body.conversationId}`);
  });

  test("rejects a non-image upload", async () => {
    const { status, body } = await uploadPhoto({
      buffer: Buffer.from("not an image"),
      type: "text/plain",
      filename: "notes.txt",
    });
    assert.equal(status, 422);
    assert.match(body.error.message, /Unsupported image type/);
  });

  test("requires a name", async () => {
    const { status, body } = await uploadPhoto({ name: "" });
    assert.equal(status, 400);
    assert.equal(body.error.message, "Validation failed");
  });

  test("refuses a vendor that fetches assets itself while storage is local", async () => {
    const { status, body } = await uploadPhoto({ providerId: "tavus" });

    assert.equal(status, 422);
    assert.match(body.error.message, /fetches uploads from its own servers/);
    // The guidance has to name the way out, not just the problem.
    assert.match(body.error.message, /STORAGE_DRIVER=r2|PUBLIC_BASE_URL/);
  });

  test("does not apply that limit to a vendor that accepts the bytes", async () => {
    const { body } = await uploadPhoto({ providerId: "lemonslice" });

    // Rejected for the missing key, not for the storage driver - LemonSlice
    // never fetches the image itself.
    assert.match(body.error.message, /no API key configured/);
    assert.doesNotMatch(body.error.message, /STORAGE_DRIVER|fetches uploads/);
  });

  test("refuses a vendor that has no Node plugin", async () => {
    const { status, body } = await uploadPhoto({ providerId: "simli" });
    assert.equal(status, 501);
    assert.match(body.error.message, /Python-only/);
  });

  test("leaves no orphaned asset when the vendor rejects the image", async () => {
    const { AvatarAsset } = await import("../../src/models/index.js");
    const before = await AvatarAsset.countDocuments();

    await uploadPhoto({ providerId: "tavus" });

    assert.equal(await AvatarAsset.countDocuments(), before, "asset should be rolled back");
  });
});
