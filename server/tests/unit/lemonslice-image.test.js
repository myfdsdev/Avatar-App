/**
 * How LemonSlice gets the avatar image.
 *
 * This is the decision that lets the integration work without object storage,
 * so it is worth pinning independently of a live call: a publicly reachable URL
 * is passed through, and anything on a private host is fetched and sent as
 * bytes instead.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { resolveImage } from "../../src/agent/renderers/lemonslice.renderer.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

let server;
let origin;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/missing") {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": "image/png" }).end(PNG);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

describe("resolveImage", () => {
  test("passes a public URL straight through", async () => {
    const out = await resolveImage({ providerAvatarId: "https://cdn.example.com/face.png" });

    assert.equal(out.agentImageUrl, "https://cdn.example.com/face.png");
    assert.equal(out.agentImage, undefined, "a reachable URL should not be downloaded");
  });

  test("sends bytes for a private host, which is what makes local storage work", async () => {
    const out = await resolveImage({ providerAvatarId: `${origin}/face.png` });

    assert.ok(Buffer.isBuffer(out.agentImage));
    assert.equal(out.agentImage.length, PNG.length);
    assert.equal(out.agentImageMimeType, "image/png");
    assert.equal(out.agentImageUrl, undefined, "bytes and URL are mutually exclusive");
  });

  test("falls back to previewUrl when there is no provider id", async () => {
    const out = await resolveImage({ previewUrl: "https://cdn.example.com/preview.jpg" });
    assert.equal(out.agentImageUrl, "https://cdn.example.com/preview.jpg");
  });

  test("reports an unreadable image rather than starting a call without one", async () => {
    await assert.rejects(
      () => resolveImage({ providerAvatarId: `${origin}/missing` }),
      /Could not read avatar image \(404\)/,
    );
  });

  test("rejects an avatar with no image at all", async () => {
    await assert.rejects(() => resolveImage({}), /no image to render/);
  });

  test("rejects a malformed URL", async () => {
    await assert.rejects(() => resolveImage({ providerAvatarId: "not a url" }), /not a valid URL/);
  });
});
