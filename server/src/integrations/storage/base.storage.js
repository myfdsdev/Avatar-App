/**
 * Contract for where uploaded photos and training videos live.
 *
 * The one thing every driver must guarantee is `publicUrl`: avatar vendors
 * fetch assets from their own infrastructure, so a URL that only resolves
 * inside this process is useless to them. Drivers that cannot produce a
 * genuinely public URL must say so via `reachableByVendors`, rather than
 * returning a localhost URL and failing later at the vendor call.
 */
export class BaseStorage {
  constructor(id) {
    if (new.target === BaseStorage) throw new TypeError("BaseStorage is abstract");
    this.id = id;
  }

  /** Whether URLs from this driver can be fetched from the public internet. */
  get reachableByVendors() {
    return false;
  }

  /**
   * Confirms the claim above, for drivers where it is not knowable from config
   * alone. Called once at startup; a no-op for drivers that already know.
   */
  async verifyPublicAccess() {
    return this.reachableByVendors;
  }

  /**
   * @param {{ buffer: Buffer, key: string, contentType: string }} input
   * @returns {Promise<{ storageKey: string, publicUrl: string, bytes: number }>}
   */
  // eslint-disable-next-line no-unused-vars
  async put(input) {
    throw new Error(`${this.id}: put() not implemented`);
  }

  /** @param {string} storageKey */
  // eslint-disable-next-line no-unused-vars
  async remove(storageKey) {
    throw new Error(`${this.id}: remove() not implemented`);
  }
}
