/**
 * The avatar settings page: editing an avatar after it exists.
 *
 * Patches arrive field by field while someone types, so what matters is that a
 * patch touches only what it names, that clearing a field works, and that the
 * settings reach the persona the call pipeline reads.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { signIn, signUp, startTestApp } from "../helpers.js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../src/scripts/seed.js";
import { defaultVoiceFor } from "../../src/ai/catalog.js";
import { DEFAULT_PROMPT } from "../../src/ai/prompts/personality.js";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

let app;
let demo;
let stockChoice;

before(async () => {
  app = await startTestApp();
  demo = await signIn(app.baseUrl, { email: DEMO_EMAIL, password: DEMO_PASSWORD });
  const { body } = await demo.get("/api/studio/stock");
  [stockChoice] = body.avatars;
});

after(() => app.stop());

const adopt = (extra = {}) =>
  demo
    .post("/api/studio/stock", {
      providerId: stockChoice.providerId,
      providerAvatarId: stockChoice.providerAvatarId,
      ...extra,
    })
    .then((r) => r.body.avatar);

describe("editing an avatar", () => {
  test("renames the avatar and its persona together", async () => {
    const avatar = await adopt({ name: "Before" });
    const { status, body } = await demo.patch(`/api/avatars/${avatar._id}`, { name: "After" });

    assert.equal(status, 200);
    assert.equal(body.avatar.name, "After");
    assert.equal(body.avatar.personaId.name, "After persona");
  });

  test("patches only the persona fields it names", async () => {
    const avatar = await adopt({ name: "Partial", behaviour: { greeting: "Hello there" } });

    const { body } = await demo.patch(`/api/avatars/${avatar._id}`, {
      persona: { voice: "Olivia", voiceSpeed: 0.9, useDefaultPrompt: true, llmModel: "openai/gpt-5-mini" },
    });

    const persona = body.avatar.personaId;
    assert.equal(persona.voice, "Olivia");
    assert.equal(persona.voiceSpeed, 0.9);
    assert.equal(persona.useDefaultPrompt, true);
    assert.equal(persona.llmModel, "openai/gpt-5-mini");
    assert.equal(persona.greeting, "Hello there", "an untouched field must survive");
  });

  test("a blank clears an optional field, and the brief falls back to the default", async () => {
    const avatar = await adopt({ name: "Clear", behaviour: { greeting: "Hi", systemPrompt: "Be terse." } });

    const { body } = await demo.patch(`/api/avatars/${avatar._id}`, {
      persona: { greeting: "", systemPrompt: "" },
    });

    assert.equal(body.avatar.personaId.greeting, undefined);
    assert.equal(body.avatar.personaId.systemPrompt, DEFAULT_PROMPT);
  });

  test("a blank call length goes back to the install default", async () => {
    const avatar = await adopt({ name: "Cap", behaviour: { maxCallSeconds: 900 } });

    const { status, body } = await demo.patch(`/api/avatars/${avatar._id}`, {
      persona: { maxCallSeconds: "" },
    });
    assert.equal(status, 200);
    assert.equal(body.avatar.personaId.maxCallSeconds, undefined);
  });

  test("stores how the face is rendered", async () => {
    const avatar = await adopt({ name: "Render" });
    const { body } = await demo.patch(`/api/avatars/${avatar._id}`, {
      render: { aspectRatio: "9x16", model: "flash" },
    });

    assert.deepEqual(body.avatar.render, { aspectRatio: "9x16", model: "flash" });
  });

  test("refuses values the pipeline cannot honour", async () => {
    const avatar = await adopt({ name: "Bad" });

    const speed = await demo.patch(`/api/avatars/${avatar._id}`, { persona: { voiceSpeed: 3 } });
    assert.equal(speed.status, 400);

    const unknown = await demo.patch(`/api/avatars/${avatar._id}`, { providerId: "other" });
    assert.equal(unknown.status, 400, "fields outside the settings page are not editable here");
  });

  test("refuses a voice or language model the call pipeline does not have", async () => {
    const avatar = await adopt({ name: "Unknowns" });

    const voice = await demo.patch(`/api/avatars/${avatar._id}`, { persona: { voice: "Nobody" } });
    assert.equal(voice.status, 400);

    const model = await demo.patch(`/api/avatars/${avatar._id}`, { persona: { llmModel: "gpt-99" } });
    assert.equal(model.status, 400);
  });

  test("a call to an avatar whose settings would break it is refused with the reason", async () => {
    const { body } = await demo.get("/api/avatars");
    const seeded = body.avatars.find((a) => a.providerId === "mock");
    const { Persona } = await import("../../src/models/index.js");
    // Bypasses the API's own check, as an old or hand-edited record would.
    await Persona.updateOne({ _id: seeded.personaId._id }, { $set: { voice: "Nobody" } });

    const { status, body: refused } = await demo.post("/api/rooms", { avatarId: String(seeded._id) });
    assert.equal(status, 422);
    assert.match(refused.error.message, /cannot take calls yet/);

    await Persona.updateOne({ _id: seeded.personaId._id }, { $unset: { voice: "" } });
  });

  test("cannot edit another workspace's avatar", async () => {
    const avatar = await adopt({ name: "Private" });
    const stranger = await signUp(app.baseUrl);

    const { status } = await stranger.patch(`/api/avatars/${avatar._id}`, { name: "Mine now" });
    assert.equal(status, 404);
  });
});

describe("character gender", () => {
  test("a new character starts with a voice to match", async () => {
    const avatar = await adopt({ name: "Voiced", gender: "male" });
    const { body } = await demo.get(`/api/avatars/${avatar._id}`);

    assert.equal(body.avatar.gender, "male");
    assert.equal(body.avatar.personaId.voice, defaultVoiceFor("male"));
  });

  test("a ready-made face is tagged once, then listed and adopted with it", async () => {
    const tag = await demo.put("/api/studio/stock/gender", {
      providerId: stockChoice.providerId,
      providerAvatarId: stockChoice.providerAvatarId,
      gender: "female",
    });
    assert.equal(tag.status, 200);

    const { body: list } = await demo.get("/api/studio/stock");
    const listed = list.avatars.find((a) => a.providerAvatarId === stockChoice.providerAvatarId);
    assert.equal(listed.gender, "female");

    const avatar = await adopt({ name: "Tagged" });
    assert.equal(avatar.gender, "female");
  });

  test("the tag is per workspace", async () => {
    const stranger = await signUp(app.baseUrl);
    const { body } = await stranger.get("/api/studio/stock");
    const listed = body.avatars.find((a) => a.providerAvatarId === stockChoice.providerAvatarId);
    assert.equal(listed.gender, null);
  });
});

describe("the photo flow keeps its brief", () => {
  test("behaviour sent with a photo reaches the persona", async () => {
    const form = new FormData();
    form.append("name", "Photo brief");
    form.append("gender", "female");
    form.append("behaviour", JSON.stringify({ greeting: "Hello from a photo" }));
    form.append("image", new Blob([PNG_1PX], { type: "image/png" }), "face.png");

    const { status, body } = await demo.upload("/api/studio/photo", form);
    assert.equal(status, 201);

    const { body: fetched } = await demo.get(`/api/avatars/${body.avatar._id}`);
    assert.equal(fetched.avatar.personaId.greeting, "Hello from a photo");
    assert.equal(fetched.avatar.personaId.voice, defaultVoiceFor("female"));
  });
});

describe("what the settings page can offer", () => {
  test("options list voices, language models and render choices", async () => {
    const { body } = await demo.get("/api/studio/options");

    assert.ok(Array.isArray(body.voices));
    assert.ok(body.llmModels.some((m) => m.available), "at least one model must be usable");
    assert.ok(body.defaultLlmModel);
    assert.ok(body.renderModels.some((m) => m.id === "standard"));
    assert.ok(body.aspectRatios.some((r) => r.id === "2x3"));
  });
});
