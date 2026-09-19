import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BaseStorage } from "./base.storage.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

/**
 * Cloudflare R2 over the S3 API.
 *
 * Being able to upload says nothing about whether anyone else can read. R2's
 * S3 endpoint accepts writes with signed credentials and then refuses unsigned
 * reads, so a bucket configured with that endpoint as its public base URL looks
 * completely healthy here and fails at the vendor minutes later.
 *
 * So this starts out assuming reads are NOT public and only flips once a probe
 * proves otherwise. Failing closed means the studio refuses a vendor with a
 * clear reason instead of handing it a URL it will get a 400 from.
 *
 * Public reads need either the bucket's r2.dev development URL or a custom
 * domain - not the S3 API endpoint.
 */
export class R2Storage extends BaseStorage {
  constructor() {
    super("r2");

    const missing = ["accountId", "accessKeyId", "secretAccessKey", "bucket", "publicBaseUrl"]
      .filter((k) => !env.storage[k]);
    if (missing.length) {
      throw new Error(`R2 storage is missing config: ${missing.join(", ")}`);
    }

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${env.storage.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.storage.accessKeyId,
        secretAccessKey: env.storage.secretAccessKey,
      },
    });

    /** Unknown until verified, and treated as "no" until then. */
    this.publicReads = false;
    this.publicReadsError = "not verified yet";
  }

  get reachableByVendors() {
    return this.publicReads;
  }

  /**
   * Uploads a probe and fetches it back with no credentials, which is exactly
   * what a vendor does. Runs once at startup; cheap, and the alternative is
   * discovering the answer from a vendor's error log.
   */
  async verifyPublicAccess() {
    const key = `healthcheck/${Date.now()}.txt`;
    let stored;

    try {
      stored = await this.put({
        buffer: Buffer.from("avatar-app public access probe"),
        key,
        contentType: "text/plain",
      });
    } catch (err) {
      this.publicReads = false;
      this.publicReadsError = `upload failed: ${err.message}`;
      logger.error({ err: err.message }, "r2 upload failed");
      return false;
    }

    try {
      const res = await fetch(stored.publicUrl, { signal: AbortSignal.timeout(15_000) });
      this.publicReads = res.ok;
      this.publicReadsError = res.ok
        ? null
        : `public reads return ${res.status}. R2_PUBLIC_BASE_URL must be the bucket's ` +
          `r2.dev development URL or a custom domain, not the S3 API endpoint.`;
    } catch (err) {
      this.publicReads = false;
      this.publicReadsError = `public URL unreachable: ${err.message}`;
    } finally {
      await this.remove(stored.storageKey).catch(() => {});
    }

    if (this.publicReads) {
      logger.info({ base: env.storage.publicBaseUrl }, "r2 uploads are publicly readable");
    } else {
      logger.warn({ reason: this.publicReadsError }, "r2 uploads are NOT publicly readable");
    }
    return this.publicReads;
  }

  async put({ buffer, key, contentType }) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.storage.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return {
      storageKey: key,
      publicUrl: `${env.storage.publicBaseUrl.replace(/\/$/, "")}/${key}`,
      bytes: buffer.length,
      contentType,
    };
  }

  async remove(storageKey) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: env.storage.bucket, Key: storageKey }),
    );
  }
}
