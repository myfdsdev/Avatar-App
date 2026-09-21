import fs from "node:fs/promises";
import path from "node:path";
import { BaseStorage } from "./base.storage.js";
import { env } from "../../config/env.js";

const UPLOAD_DIR = path.resolve("uploads");

/**
 * Writes to disk and serves through Express.
 *
 * Deliberately reports reachableByVendors = false: these URLs are localhost,
 * which a vendor's own servers cannot fetch. Fine for the mock provider and for
 * developing the upload flow; anything that hands a URL to a real vendor needs
 * R2 or a tunnel.
 */
export class LocalStorage extends BaseStorage {
  constructor() {
    super("local");
  }

  get reachableByVendors() {
    return false;
  }

  async put({ buffer, key, contentType }) {
    const target = path.join(UPLOAD_DIR, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);

    return {
      storageKey: key,
      publicUrl: `${env.publicBaseUrl}/uploads/${key}`,
      bytes: buffer.length,
      contentType,
    };
  }

  async remove(storageKey) {
    await fs.rm(path.join(UPLOAD_DIR, storageKey), { force: true });
  }

  static get uploadDir() {
    return UPLOAD_DIR;
  }
}
