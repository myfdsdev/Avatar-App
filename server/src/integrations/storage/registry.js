import { LocalStorage } from "./local.storage.js";
import { R2Storage } from "./r2.storage.js";
import { env } from "../../config/env.js";

const FACTORIES = {
  local: () => new LocalStorage(),
  r2: () => new R2Storage(),
};

let instance;

/** The configured driver. Defaults to local so a fresh clone needs no bucket. */
export function getStorage() {
  if (!instance) {
    const factory = FACTORIES[env.storageDriver];
    if (!factory) {
      throw new Error(
        `Unknown STORAGE_DRIVER "${env.storageDriver}". Available: ${Object.keys(FACTORIES).join(", ")}`,
      );
    }
    instance = factory();
  }
  return instance;
}

export const storageDriverIds = () => Object.keys(FACTORIES);
