/**
 * An avatar's knowledge base over HTTP: add, list, remove - scoped to the
 * workspace, and gone with the avatar.
 */
import "../setup-env.js";
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { signIn, signUp, startTestApp } from "../helpers.js";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../src/scripts/seed.js";
import { MAX_DOCS } from "../../src/ai/knowledge.js";
import { tinyPdf } from "../fixtures/pdf.js";

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

const newAvatar = async (name) => {
  const { body } = await demo.post("/api/studio/stock", {
    providerId: stockChoice.providerId,
    providerAvatarId: stockChoice.providerAvatarId,
    name,
  });
  return body.avatar;
};

const upload = (client, avatarId, { buffer, filename, type = "application/octet-stream" }) => {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type }), filename);
  return client.upload(`/api/avatars/${avatarId}/documents`, form);
};

describe("adding documents", () => {
  test("a PDF is read and listed without its text", async () => {
    const avatar = await newAvatar("Docs");
    const { status, body } = await upload(demo, avatar._id, {
      buffer: tinyPdf("Refunds take five working days"),
      filename: "policy.pdf",
      type: "application/pdf",
    });

    assert.equal(status, 201);
    assert.equal(body.document.name, "policy.pdf");
    assert.equal(body.document.chars, "Refunds take five working days".length);
    assert.equal(body.document.text, undefined, "the listing never carries the text");

    const { body: list } = await demo.get(`/api/avatars/${avatar._id}/documents`);
    assert.deepEqual(
      list.documents.map((d) => d.name),
      ["policy.pdf"],
    );
  });

  test("the text is what a call will read", async () => {
    const avatar = await newAvatar("For call");
    await upload(demo, avatar._id, { buffer: Buffer.from("Open nine to five."), filename: "hours.txt" });

    const { knowledgeService } = await import("../../src/modules/avatars/knowledge.service.js");
    const docs = await knowledgeService.forCall(avatar._id);
    assert.deepEqual(
      docs.map((d) => [d.name, d.text]),
      [["hours.txt", "Open nine to five."]],
    );
  });

  test("refuses a type it cannot read", async () => {
    const avatar = await newAvatar("Bad type");
    const { status, body } = await upload(demo, avatar._id, { buffer: Buffer.from("MZ"), filename: "tool.exe" });
    assert.equal(status, 422);
    assert.match(body.error.message, /Unsupported document type/);
  });

  test("caps how many one avatar holds", async () => {
    const avatar = await newAvatar("Full");
    for (let i = 0; i < MAX_DOCS; i += 1) {
      await upload(demo, avatar._id, { buffer: Buffer.from(`Note ${i}`), filename: `note-${i}.txt` });
    }
    const { status, body } = await upload(demo, avatar._id, { buffer: Buffer.from("One more"), filename: "extra.txt" });
    assert.equal(status, 422);
    assert.match(body.error.message, /can hold/);
  });
});

describe("removing documents", () => {
  test("removes one", async () => {
    const avatar = await newAvatar("Remove one");
    const { body } = await upload(demo, avatar._id, { buffer: Buffer.from("Temp"), filename: "temp.txt" });

    const { status } = await demo.del(`/api/avatars/${avatar._id}/documents/${body.document._id}`);
    assert.equal(status, 200);

    const { body: list } = await demo.get(`/api/avatars/${avatar._id}/documents`);
    assert.equal(list.documents.length, 0);
  });

  test("deleting the avatar deletes its documents", async () => {
    const avatar = await newAvatar("Gone");
    await upload(demo, avatar._id, { buffer: Buffer.from("Orphan?"), filename: "orphan.txt" });
    await demo.del(`/api/avatars/${avatar._id}`);

    const { KnowledgeDocument } = await import("../../src/models/index.js");
    assert.equal(await KnowledgeDocument.countDocuments({ avatarId: avatar._id }), 0);
  });
});

describe("tenancy", () => {
  test("another workspace can neither read nor add", async () => {
    const avatar = await newAvatar("Private docs");
    await upload(demo, avatar._id, { buffer: Buffer.from("Secret"), filename: "secret.txt" });
    const stranger = await signUp(app.baseUrl);

    const read = await stranger.get(`/api/avatars/${avatar._id}/documents`);
    assert.equal(read.status, 404);

    const write = await upload(stranger, avatar._id, { buffer: Buffer.from("Mine"), filename: "mine.txt" });
    assert.equal(write.status, 404);
  });
});
