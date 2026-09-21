/**
 * What an avatar says, and whether that brief survives the trip to the vendor.
 *
 * Both halves matter and they fail differently: a persona that is never saved
 * loses the brief at creation, and a persona that is saved but never sent loses
 * it at call time - silently, on exactly the vendors that run the conversation
 * themselves.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { signIn, startTestApp } from "../helpers.js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../src/scripts/seed.js";

let app;
let demo;
let stockChoice;

const BRIEF = {
  systemPrompt: "You are a patient language tutor. Correct mistakes gently.",
  greeting: "Hey! What would you like to practise?",
};

before(async () => {
  app = await startTestApp();
  demo = await signIn(app.baseUrl, { email: DEMO_EMAIL, password: DEMO_PASSWORD });
  const { body } = await demo.get("/api/studio/stock");
  [stockChoice] = body.avatars;
});

after(() => app.stop());

const adopt = ({ name, ...behaviour } = {}) =>
  demo.post("/api/studio/stock", {
    providerId: stockChoice.providerId,
    providerAvatarId: stockChoice.providerAvatarId,
    ...(name ? { name } : {}),
    ...(Object.keys(behaviour).length ? { behaviour } : {}),
  });

describe("creating with a brief", () => {
  test("saves it as a persona linked to the avatar", async () => {
    const { status, body } = await adopt({ name: "Tutor", ...BRIEF });
    assert.equal(status, 201);
    assert.ok(body.avatar.personaId, "the avatar must carry a persona");

    const { Persona } = await import("../../src/models/index.js");
    const persona = await Persona.findById(body.avatar.personaId).lean();
    assert.equal(persona.systemPrompt, BRIEF.systemPrompt);
    assert.equal(persona.greeting, BRIEF.greeting);
  });

  test("falls back to a default brief rather than none", async () => {
    const { body } = await adopt({ name: "No brief" });

    const { Persona } = await import("../../src/models/index.js");
    const persona = await Persona.findById(body.avatar.personaId).lean();
    assert.ok(persona.systemPrompt.length > 0, "an avatar with no instructions is useless");
    assert.equal(persona.greeting, undefined, "a greeting is genuinely optional");
  });

  test("reports the default so the UI shows the real one", async () => {
    const { body } = await demo.get("/api/studio/options");
    assert.ok(body.defaultPrompt?.length > 0);
  });

  test("rejects an absurdly long brief", async () => {
    const { status } = await adopt({ name: "Too long", systemPrompt: "x".repeat(5000) });
    assert.equal(status, 400);
  });

  test("the persona belongs to the creating workspace", async () => {
    const { body } = await adopt({ name: "Scoped", ...BRIEF });

    const { Persona } = await import("../../src/models/index.js");
    const persona = await Persona.findById(body.avatar.personaId).lean();
    assert.equal(String(persona.workspaceId), String(app.seeded.workspace._id));
  });
});

describe("the brief reaching the vendor", () => {
  test("a full-pipeline vendor is given the prompt and greeting", async () => {
    const { body: created } = await adopt({ name: "Hosted tutor", ...BRIEF });

    // mock-hosted records what it was asked for, standing in for a hosted vendor.
    const { getProvider } = await import("../../src/avatar/providers/registry.js");
    const provider = getProvider("mock-hosted");

    const seen = [];
    const original = provider.createSession.bind(provider);
    provider.createSession = async (input) => {
      seen.push(input);
      return original(input);
    };

    try {
      const started = await demo.post("/api/rooms", { avatarId: created.avatar._id });
      assert.equal(started.status, 201);

      assert.equal(seen.length, 1, "the vendor should have been asked once");
      assert.equal(
        seen[0].persona?.systemPrompt,
        BRIEF.systemPrompt,
        "without this the brief is silently dropped for hosted vendors",
      );
      assert.equal(seen[0].persona?.greeting, BRIEF.greeting);

      await demo.del(`/api/rooms/${started.body.conversationId}`);
    } finally {
      provider.createSession = original;
    }
  });
});
