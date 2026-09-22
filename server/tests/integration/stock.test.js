/**
 * Ready-made avatars: using a vendor's own pre-trained face.
 *
 * This is the route that matters when training is a paid feature and listing
 * is not - the account can still get a real, callable avatar. Exercised through
 * `mock-hosted`, which mirrors a hosted vendor (full-pipeline, stock-backed) so the path
 * stays honest without spending a vendor's quota.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { signIn, signUp, startTestApp } from "../helpers.js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../src/scripts/seed.js";

let app;
let demo;

before(async () => {
  app = await startTestApp();
  demo = await signIn(app.baseUrl, { email: DEMO_EMAIL, password: DEMO_PASSWORD });
});

after(() => app.stop());

describe("listing ready-made avatars", () => {
  test("returns them tagged with the provider that owns them", async () => {
    const { status, body } = await demo.get("/api/studio/stock");

    assert.equal(status, 200);
    assert.ok(body.avatars.length > 0);
    for (const a of body.avatars) {
      assert.ok(a.providerAvatarId, "every entry needs the vendor's id");
      assert.ok(a.name);
      assert.ok(a.providerId, "the caller has to know which vendor to adopt from");
    }
  });

  test("requires authentication", async () => {
    const res = await fetch(`${app.baseUrl}/api/studio/stock`);
    assert.equal(res.status, 401);
  });

  test("offers stub catalogues only while stub mode is on", async () => {
    const { isDevelopmentOnly } = await import("../../src/avatar/capabilities.js");
    const { body } = await demo.get("/api/studio/stock");
    const { body: options } = await demo.get("/api/studio/options");

    const fromStubs = body.avatars.filter((a) => isDevelopmentOnly(a.providerId));

    if (options.stubMode) {
      assert.ok(fromStubs.length > 0, "stub mode should surface the stub catalogue");
    } else {
      // Their entries point at URLs that do not resolve, so a leak here puts
      // broken tiles in front of real users.
      assert.deepEqual(fromStubs, [], "a stub catalogue must not reach the picker");
    }
  });
});

describe("adopting one", () => {
  test("creates a ready, callable avatar with nothing uploaded", async () => {
    const { body: list } = await demo.get("/api/studio/stock");
    const choice = list.avatars[0];

    const { status, body } = await demo.post("/api/studio/stock", {
      providerId: choice.providerId,
      providerAvatarId: choice.providerAvatarId,
      name: "Adopted avatar",
    });

    assert.equal(status, 201);
    assert.equal(body.avatar.sourceType, "stock");
    assert.equal(body.avatar.status, "ready");
    assert.equal(body.avatar.providerAvatarId, choice.providerAvatarId);
    // Nothing was uploaded, so there is no asset behind it.
    assert.equal(body.avatar.assetId, undefined);

    const { body: fetched } = await demo.get(`/api/avatars/${body.avatar._id}`);
    assert.equal(fetched.avatar.callable, true);
    assert.equal(fetched.avatar.isStub, true, "mock-hosted is a stub and must say so");
  });

  test("falls back to the vendor's own name", async () => {
    const { body: list } = await demo.get("/api/studio/stock");
    const choice = list.avatars[1];

    const { body } = await demo.post("/api/studio/stock", {
      providerId: choice.providerId,
      providerAvatarId: choice.providerAvatarId,
    });

    assert.equal(body.avatar.name, choice.name);
  });

  test("refuses an id the vendor does not have", async () => {
    const { status, body } = await demo.post("/api/studio/stock", {
      providerId: "mock-hosted",
      providerAvatarId: "not-a-real-face",
    });

    assert.equal(status, 422);
    assert.match(body.error.message, /is not one of/);
  });

  test("refuses a provider that has no ready-made avatars", async () => {
    const { status, body } = await demo.post("/api/studio/stock", {
      providerId: "mock",
      providerAvatarId: "anything",
    });

    assert.equal(status, 422);
    assert.match(body.error.message, /no ready-made avatars/);
  });

  test("an adopted avatar belongs to the workspace that adopted it", async () => {
    const { body: list } = await demo.get("/api/studio/stock");
    const choice = list.avatars[0];

    const { body } = await demo.post("/api/studio/stock", {
      providerId: choice.providerId,
      providerAvatarId: choice.providerAvatarId,
      name: "Mine only",
    });

    // The same vendor face can be adopted by anyone, but the record is ours.
    const stranger = await signUp(app.baseUrl);
    const seen = await stranger.get(`/api/avatars/${body.avatar._id}`);
    assert.equal(seen.status, 404);
  });
});
