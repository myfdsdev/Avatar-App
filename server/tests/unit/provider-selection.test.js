/**
 * Which vendor an unattended request gets.
 *
 * Pinned because getting this wrong is silent: the stub costs nothing, so a
 * plain cheapest-first sort picked it every time and handed people a fake
 * avatar that looked like a real one.
 */
import "../setup-env.js";
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  CAPABILITIES,
  isDevelopmentOnly,
  requiresPublicUrl,
} from "../../src/avatar/capabilities.js";
import { candidatesForSource, isConfigured } from "../../src/avatar/providers/registry.js";

describe("automatic provider selection", () => {
  test("never offers a development stub", () => {
    for (const source of ["photo", "video"]) {
      const candidates = candidatesForSource(source);
      const stubs = candidates.filter(isDevelopmentOnly);
      assert.deepEqual(stubs, [], `${source} candidates must exclude stubs, got ${candidates}`);
    }
  });

  test("offers only vendors that have credentials", () => {
    for (const source of ["photo", "video"]) {
      for (const id of candidatesForSource(source)) {
        assert.ok(isConfigured(id), `${id} appeared as a candidate without credentials`);
      }
    }
  });

  test("offers only vendors this runtime can drive", () => {
    for (const source of ["photo", "video"]) {
      for (const id of candidatesForSource(source)) {
        assert.ok(CAPABILITIES[id].nodePlugin, `${id} has no Node plugin`);
      }
    }
  });

  test("orders by cost, cheapest first", () => {
    const costs = candidatesForSource("photo").map((id) => CAPABILITIES[id].approxCostPerMinUsd);
    const sorted = [...costs].sort((a, b) => a - b);
    assert.deepEqual(costs, sorted);
  });
});

describe("capability flags stay coherent", () => {
  test("every stub is priced at zero, and nothing real is", () => {
    for (const [id, caps] of Object.entries(CAPABILITIES)) {
      if (caps.developmentOnly) {
        assert.equal(caps.approxCostPerMinUsd, 0, `${id} is a stub but is priced`);
      } else {
        assert.ok(caps.approxCostPerMinUsd > 0, `${id} is a real vendor priced at zero`);
      }
    }
  });

  test("a vendor needs public storage exactly when it cannot take bytes", () => {
    for (const id of Object.keys(CAPABILITIES)) {
      assert.equal(
        requiresPublicUrl(id),
        !CAPABILITIES[id].acceptsDirectUpload,
        `${id} disagrees about whether it needs public storage`,
      );
    }
  });
});
