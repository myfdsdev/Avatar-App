/**
 * What the studio offers as a provider choice.
 *
 * A development stub listed beside real vendors is an invitation to pick one,
 * and someone did: the resulting avatar generated nothing and played back the
 * uploaded file. The stub is now hidden unless the install is explicitly in
 * stub mode.
 */
import "../setup-env.js";
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { CAPABILITIES, isDevelopmentOnly } from "../../src/avatar/capabilities.js";
import { studioService } from "../../src/modules/studio/studio.service.js";
import { env } from "../../src/config/env.js";

describe("studio provider offerings", () => {
  test("reports whether this install is in stub mode", () => {
    const { stubMode } = studioService.options();
    assert.equal(stubMode, isDevelopmentOnly(env.avatarProvider));
  });

  test("offers stubs only while stub mode is on", () => {
    const { stubMode, providers } = studioService.options();
    const offeredStubs = providers.filter((p) => isDevelopmentOnly(p.id));

    if (stubMode) {
      assert.ok(offeredStubs.length > 0, "stub mode should surface the stub");
    } else {
      assert.deepEqual(offeredStubs, [], "a stub must never be offered as a product choice");
    }
  });

  test("never offers a vendor this runtime cannot drive", () => {
    for (const p of studioService.options().providers) {
      assert.ok(CAPABILITIES[p.id].nodePlugin, `${p.id} has no Node plugin`);
    }
  });

  test("every offered provider can do at least one source", () => {
    for (const p of studioService.options().providers) {
      assert.ok(p.photoAvatar || p.videoClone, `${p.id} can serve neither source`);
    }
  });
});
