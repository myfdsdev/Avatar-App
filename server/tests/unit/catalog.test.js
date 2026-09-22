/**
 * The settings catalogue: what the page offers must be what a call can use.
 */
import "../setup-env.js";
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { defaultVoiceFor, isHostedModel, speedOption, voicesForTts } from "../../src/ai/catalog.js";

describe("voices", () => {
  test("Inworld models get the Inworld list, in both genders", () => {
    const voices = voicesForTts("inworld/inworld-tts-2");
    assert.ok(voices.some((v) => v.gender === "female"));
    assert.ok(voices.some((v) => v.gender === "male"));
  });

  test("a model the catalogue does not know gets no list rather than wrong names", () => {
    assert.deepEqual(voicesForTts("rime/arcana"), []);
  });

  test("each gender's default voice is one of the offered voices", () => {
    const ids = voicesForTts().map((v) => v.id);
    if (!ids.length) return;
    assert.ok(ids.includes(defaultVoiceFor("female")));
    assert.ok(ids.includes(defaultVoiceFor("male")));
  });
});

describe("speed", () => {
  test("uses the option name each TTS model expects", () => {
    assert.deepEqual(speedOption("inworld/inworld-tts-2", 0.9), { speaking_rate: 0.9 });
    assert.deepEqual(speedOption("cartesia/sonic-3", 1.2), { speed: 1.2 });
  });

  test("sends nothing for natural speed or an unknown model", () => {
    assert.equal(speedOption("inworld/inworld-tts-2", 1), undefined);
    assert.equal(speedOption("inworld/inworld-tts-2", undefined), undefined);
    assert.equal(speedOption("rime/arcana", 0.8), undefined);
  });
});

test("hosted model ids carry a provider; Claude ids do not", () => {
  assert.equal(isHostedModel("google/gemma-4-31b-it"), true);
  assert.equal(isHostedModel("claude-sonnet-5"), false);
  assert.equal(isHostedModel(undefined), false);
});
