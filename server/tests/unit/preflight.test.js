/**
 * The check every call runs before it opens a vendor session - and that
 * `npm run check:avatars` runs over every avatar. A setting that would break
 * a call must show up here as an error, not as a caller stuck on "Connecting".
 */
import "../setup-env.js";
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { preflight } from "../../src/agent/preflight.js";
import { voiceFor } from "../../src/ai/catalog.js";

// setup-env pins AVATAR_PROVIDER=mock (configured) and no LemonSlice key.
const good = {
  name: "Test",
  providerId: "mock",
  status: "ready",
  providerAvatarId: "mock_av_1",
  persona: { systemPrompt: "Be kind.", voice: "Ashley", language: "en" },
};

describe("preflight", () => {
  test("a well-formed avatar passes", async () => {
    const { errors, warnings } = await preflight(good);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
  });

  test("a voice the TTS model does not have is an error", async () => {
    const { errors } = await preflight({ ...good, persona: { ...good.persona, voice: "Nobody" } });
    assert.match(errors.join(" "), /Voice "Nobody"/);
  });

  test("an unknown language model is an error; Claude without a key only falls back", async () => {
    const unknown = await preflight({ ...good, persona: { ...good.persona, llmModel: "gpt-99" } });
    assert.match(unknown.errors.join(" "), /not one this server offers/);

    const claude = await preflight({ ...good, persona: { ...good.persona, llmModel: "claude-sonnet-5" } });
    assert.deepEqual(claude.errors, []);
    assert.match(claude.warnings.join(" "), /fall back/);
  });

  test("a vendor with no key, or an avatar not ready, cannot take calls", async () => {
    const lemon = await preflight({ ...good, providerId: "lemonslice", providerAvatarId: "agent_abc123" });
    assert.match(lemon.errors.join(" "), /no API key/);

    const training = await preflight({ ...good, status: "training" });
    assert.match(training.errors.join(" "), /not ready/);
  });

  test("an image avatar needs a real address", async () => {
    const { errors } = await preflight({ ...good, providerId: "lemonslice", providerAvatarId: "not a url" });
    assert.match(errors.join(" "), /no usable image address/);
  });

  test("a language the speech models are not set up for is a warning", async () => {
    const { errors, warnings } = await preflight({ ...good, persona: { ...good.persona, language: "xx" } });
    assert.deepEqual(errors, []);
    assert.match(warnings.join(" "), /Language "xx"/);
  });
});

describe("voiceFor", () => {
  test("the persona's voice wins", () => {
    assert.equal(voiceFor({ persona: { voice: "Olivia" } }).voice, "Olivia");
  });

  test("a legacy voice from another vendor is ignored rather than sent to this TTS", () => {
    const { voice, assigned } = voiceFor({ voice: { provider: "mock", providerVoiceId: "mock-voice-1" } });
    assert.notEqual(voice, "mock-voice-1");
    assert.equal(assigned, false);
  });
});
