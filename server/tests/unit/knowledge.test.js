/**
 * Knowledge base: turning uploads into text, and text into a call's instructions.
 */
import "../setup-env.js";
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { MAX_DOC_CHARS, extractText, knowledgePrompt } from "../../src/ai/knowledge.js";
import { tinyPdf } from "../fixtures/pdf.js";

describe("extractText", () => {
  test("reads a PDF's text layer", async () => {
    const { text } = await extractText({ buffer: tinyPdf("Opening hours are nine to five"), originalname: "faq.pdf" });
    assert.equal(text, "Opening hours are nine to five");
  });

  test("reads plain text and markdown, tidying blank runs", async () => {
    const { text } = await extractText({ buffer: Buffer.from("# Menu\r\n\r\n\r\n\r\nTea  \nCoffee"), originalname: "menu.md" });
    assert.equal(text, "# Menu\n\nTea\nCoffee");
  });

  test("cuts an oversized document and says so", async () => {
    const { text, truncated } = await extractText({
      buffer: Buffer.from("a".repeat(MAX_DOC_CHARS + 10)),
      originalname: "long.txt",
    });
    assert.equal(text.length, MAX_DOC_CHARS);
    assert.equal(truncated, true);
  });

  test("refuses types it cannot read, and documents with no text", async () => {
    await assert.rejects(() => extractText({ buffer: Buffer.from("x"), originalname: "a.exe" }), /Unsupported/);
    await assert.rejects(() => extractText({ buffer: Buffer.from("  \n "), originalname: "a.txt" }), /empty/);
  });
});

describe("knowledgePrompt", () => {
  test("is empty with no documents", () => {
    assert.equal(knowledgePrompt([]), "");
    assert.equal(knowledgePrompt(undefined), "");
  });

  test("wraps each document with its name", () => {
    const prompt = knowledgePrompt([{ name: "faq.pdf", text: "Open nine to five." }]);
    assert.match(prompt, /<document name="faq.pdf">\nOpen nine to five.\n<\/document>/);
    assert.match(prompt, /say so instead of guessing/);
  });

  test("fills the budget oldest first, cuts the one that crosses it, names the rest", () => {
    const prompt = knowledgePrompt(
      [
        { name: "a", text: "x".repeat(60) },
        { name: "b", text: "y".repeat(60) },
        { name: "c", text: "z".repeat(60) },
      ],
      100,
    );
    assert.match(prompt, /x{60}/);
    assert.match(prompt, /y{40}\n\[\.\.\.cut for length\]/);
    assert.doesNotMatch(prompt, /z/);
    assert.match(prompt, /Not included, for length: c/);
  });
});
