/**
 * Bring your own key: a workspace's own LemonSlice and ElevenLabs keys are
 * checked with the vendor, stored sealed, never returned, and are the only
 * keys those vendors are ever called with.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { Workspace } from "../../src/models/index.js";
import { setWorkspaceKey, signIn, signUp, startTestApp } from "../helpers.js";

let app;
let owner;
const realFetch = globalThis.fetch;
const seen = [];
let vendorStatus = 200;

before(async () => {
  app = await startTestApp({ seed: false });
  owner = await signUp(app.baseUrl);
  // Only vendor addresses are faked; the test client's own calls pass through.
  globalThis.fetch = async (url, init) => {
    const address = String(url);
    if (address.startsWith("https://lemonslice.com/") || address.startsWith("https://api.elevenlabs.io/")) {
      seen.push({ url: address, headers: init?.headers || {} });
      return new Response(JSON.stringify({ agents: [], voices: [] }), { status: vendorStatus });
    }
    return realFetch(url, init);
  };
});

after(async () => {
  globalThis.fetch = realFetch;
  await app.stop();
});

describe("workspace API keys", () => {
  const LEMON = "ls-key-0123456789abcdWXYZ";
  const ELEVEN = "el-key-0123456789abcdQRST";

  test("start empty, and say who may change them", async () => {
    const { status, body } = await owner.get("/api/byok");
    assert.equal(status, 200);
    assert.equal(body.canManage, true);
    assert.deepEqual(body.keys, {
      lemonslice: { hasKey: false, last4: null },
      elevenlabs: { hasKey: false, last4: null },
    });
  });

  test("a key the vendor refuses is not saved", async () => {
    vendorStatus = 401;
    const res = await owner.put("/api/byok", { lemonslice: "wrong-key" });
    vendorStatus = 200;
    assert.equal(res.status, 422);
    assert.match(res.body.error.message, /LemonSlice did not accept/);
    assert.equal((await owner.get("/api/byok")).body.keys.lemonslice.hasKey, false);
  });

  test("are checked with the vendor, sealed, and never returned", async () => {
    seen.length = 0;
    const res = await owner.put("/api/byok", { lemonslice: LEMON, elevenlabs: ELEVEN });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.keys, {
      lemonslice: { hasKey: true, last4: "WXYZ" },
      elevenlabs: { hasKey: true, last4: "QRST" },
    });
    assert.equal(seen.find((s) => s.url.startsWith("https://lemonslice.com/")).headers["X-API-Key"], LEMON);
    assert.equal(seen.find((s) => s.url.startsWith("https://api.elevenlabs.io/")).headers["xi-api-key"], ELEVEN);

    const text = JSON.stringify((await owner.get("/api/byok")).body);
    assert.ok(!text.includes(LEMON) && !text.includes(ELEVEN), "key leaked");
    const raw = await Workspace.findById(owner.user.workspaceId).lean();
    assert.ok(raw.apiKeys.lemonslice && !raw.apiKeys.lemonslice.includes("0123456789"), "stored key is sealed");
  });

  test("a blank field keeps the saved key; removing one clears only it", async () => {
    assert.equal((await owner.put("/api/byok", {})).status, 422);
    const removed = await owner.del("/api/byok/elevenlabs");
    assert.deepEqual(removed.body.keys.elevenlabs, { hasKey: false, last4: null });
    assert.equal(removed.body.keys.lemonslice.last4, "WXYZ");
  });

  test("voice cloning follows the workspace's own ElevenLabs key", async () => {
    await setWorkspaceKey(owner.user.workspaceId, "elevenlabs", "");
    const off = await owner.post("/api/voices/import", { voiceId: "21m00Tcm4TlvDq8ikWAM" });
    assert.equal(off.status, 503);
    assert.match(off.body.error.message, /ElevenLabs API key/);

    // Another workspace's key is never used.
    const other = await signUp(app.baseUrl);
    await setWorkspaceKey(other.user.workspaceId, "elevenlabs", ELEVEN);
    assert.equal((await owner.post("/api/voices/import", { voiceId: "21m00Tcm4TlvDq8ikWAM" })).status, 503);
  });

  test("members see whether keys are set, and cannot change them", async () => {
    const input = { name: "Member Person", email: `m-${Date.now()}@example.com`, password: "a-long-password-1" };
    assert.equal((await owner.post("/api/team/members", { ...input, role: "member" })).status, 201);
    const member = await signIn(app.baseUrl, input);

    const { body } = await member.get("/api/byok");
    assert.equal(body.canManage, false);
    assert.equal(body.keys.lemonslice.hasKey, true);
    assert.equal((await member.put("/api/byok", { lemonslice: LEMON })).status, 403);
    assert.equal((await member.del("/api/byok/lemonslice")).status, 403);
  });
});
