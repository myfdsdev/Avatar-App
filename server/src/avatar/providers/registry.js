import { CAPABILITIES, capabilityForSource, isDevelopmentOnly } from "../capabilities.js";
import { MockAvatarProvider } from "./mock.provider.js";
import { LemonSliceProvider } from "./lemonslice.provider.js";
import { TavusProvider } from "./tavus.provider.js";
import { env } from "../../config/env.js";
import { NotSupportedError, UnavailableInRuntimeError } from "./base.provider.js";

/**
 * Resolves which vendor handles a given request.
 *
 * Adapters are constructed lazily on first use, so importing this module never
 * requires credentials and a fresh clone boots with nothing configured. A
 * vendor whose key is absent only fails when something actually asks for it.
 */

/** @type {Map<string, import("./base.provider.js").BaseAvatarProvider>} */
const instances = new Map();

/** @type {Record<string, () => import("./base.provider.js").BaseAvatarProvider>} */
const FACTORIES = {
  mock: () => new MockAvatarProvider(),
  "mock-hosted": () => new MockAvatarProvider({ id: "mock-hosted" }),
  lemonslice: () => new LemonSliceProvider({ apiKey: env.lemonsliceApiKey }),
  tavus: () => new TavusProvider({ apiKey: env.tavusApiKey }),
};

/**
 * @param {string} providerId
 * @returns {import("./base.provider.js").BaseAvatarProvider}
 */
export function getProvider(providerId) {
  if (instances.has(providerId)) return instances.get(providerId);

  const factory = FACTORIES[providerId];
  if (!factory) {
    const known = Object.keys(FACTORIES).join(", ");
    throw new Error(`Provider "${providerId}" is not implemented yet. Available: ${known}`);
  }

  const instance = factory();
  instances.set(providerId, instance);
  return instance;
}

/** Provider ids that have an adapter wired up right now. */
export const implementedProviderIds = () => Object.keys(FACTORIES);

/** Credentials each vendor needs before it can actually serve a call. */
const CREDENTIALS = {
  mock: () => true,
  "mock-hosted": () => true,
  lemonslice: () => Boolean(env.lemonsliceApiKey),
  tavus: () => Boolean(env.tavusApiKey),
};

/**
 * Whether a vendor has what it needs to run.
 *
 * Checked separately from "is it implemented", because some vendors need no
 * credential to *create* an avatar and only fail at call time - LemonSlice
 * registers nothing on its side, so without this an unconfigured key produces
 * avatars that look fine and cannot be called.
 */
export const isConfigured = (providerId) => Boolean(CREDENTIALS[providerId]?.());

/** Implemented, credentialed and usable from this runtime. */
export const availableProviderIds = () =>
  implementedProviderIds().filter((id) => isConfigured(id) && CAPABILITIES[id].nodePlugin);

/**
 * Real vendors that can serve this avatar source, cheapest first.
 *
 * Stubs are excluded on purpose. They cost nothing, so a plain cheapest-first
 * sort would always pick one - and the caller would get a fake avatar with no
 * indication that anything was substituted.
 *
 * @param {'photo'|'video'} sourceType
 */
export function candidatesForSource(sourceType) {
  const capability = capabilityForSource(sourceType);
  return availableProviderIds()
    .filter((id) => CAPABILITIES[id][capability] && !isDevelopmentOnly(id))
    .sort((a, b) => CAPABILITIES[a].approxCostPerMinUsd - CAPABILITIES[b].approxCostPerMinUsd);
}

/**
 * Pick a vendor for a create request.
 *
 * An explicit preference wins, but is still validated - a workspace pinned to
 * a photo-only vendor must not silently fall through to a different one when
 * someone uploads a video, because that changes what they are billed.
 *
 * @param {{ sourceType: 'photo'|'video', preferred?: string }} input
 */
export function selectProvider({ sourceType, preferred }) {
  const capability = capabilityForSource(sourceType);

  if (preferred) {
    const caps = CAPABILITIES[preferred];
    if (!caps) throw new Error(`Unknown provider id: ${preferred}`);
    if (!caps.nodePlugin) {
      throw new UnavailableInRuntimeError(preferred);
    }
    if (!caps[capability]) {
      throw new NotSupportedError(
        preferred,
        sourceType === "video" ? "createFromVideo" : "createFromPhoto",
      );
    }
    if (!isConfigured(preferred)) {
      const err = new Error(
        `Provider "${preferred}" has no API key configured, so avatars created ` +
          `with it could not be called.`,
      );
      err.statusCode = 422;
      throw err;
    }
    return getProvider(preferred);
  }

  // AVATAR_PROVIDER is the operator's stated default, and the only way a stub
  // gets used without being named on the request.
  const preferredDefault = env.avatarProvider;
  if (preferredDefault && canServe(preferredDefault, sourceType)) {
    return getProvider(preferredDefault);
  }

  const [cheapest] = candidatesForSource(sourceType);
  if (cheapest) return getProvider(cheapest);

  throw noProviderAvailable(sourceType, preferredDefault);
}

function canServe(providerId, sourceType) {
  const caps = CAPABILITIES[providerId];
  return Boolean(
    caps && caps.nodePlugin && caps[capabilityForSource(sourceType)] && isConfigured(providerId),
  );
}

/**
 * Says what is actually missing. Falling back to a stub here is what produced
 * the original bug, so this refuses instead and names the fix.
 */
function noProviderAvailable(sourceType, preferredDefault) {
  const capability = capabilityForSource(sourceType);
  const capable = implementedProviderIds().filter(
    (id) => CAPABILITIES[id][capability] && !isDevelopmentOnly(id),
  );
  const unconfigured = capable.filter((id) => !isConfigured(id));

  const err = new Error(
    unconfigured.length
      ? `No provider is configured for ${sourceType} avatars. ` +
        `Add an API key for one of: ${unconfigured.join(", ")}. ` +
        `To use the local stub instead, set AVATAR_PROVIDER=${preferredDefault || "mock"}.`
      : `No implemented provider supports ${sourceType} avatars`,
  );
  err.statusCode = 422;
  return err;
}
