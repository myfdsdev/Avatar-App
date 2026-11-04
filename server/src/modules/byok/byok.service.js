import { Workspace } from "../../models/index.js";
import { seal } from "../../utils/secretBox.js";
import { classifyProbe } from "../admin/system/apiConfig.service.js";
import { BYOK_SERVICES, keysOf } from "./byok.context.js";

/**
 * Saving and checking a workspace's own vendor keys. A key is tried against
 * the vendor before it is kept, so a typo is caught on the form rather than as
 * a call that never shows a face.
 */

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const VENDORS = {
  lemonslice: {
    label: "LemonSlice",
    // The account's agents: authenticated, read-only, and free.
    probe: (key) => ({ url: "https://lemonslice.com/api/agents", headers: { "X-API-Key": key } }),
  },
  elevenlabs: {
    label: "ElevenLabs",
    // Reading voices is a permission cloning needs anyway.
    probe: (key) => ({ url: "https://api.elevenlabs.io/v2/voices?page_size=1", headers: { "xi-api-key": key } }),
  },
};

async function check(service, key) {
  const { label, probe } = VENDORS[service];
  const { url, headers } = probe(key);
  let res;
  try {
    res = await fetch(url, { headers: { accept: "application/json", ...headers }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw fail(502, `Could not reach ${label} to check the key. Try again in a moment.`);
  }
  const body = await res.json().catch(() => null);
  if (classifyProbe(res.status, body).outcome === "invalid") {
    throw fail(422, `${label} did not accept this key. Check it and try again.`);
  }
}

/** What the app may show: whether each key is set, and its last four characters. */
function status(workspace) {
  const keys = keysOf(workspace);
  return Object.fromEntries(
    BYOK_SERVICES.map((s) => [s, { hasKey: Boolean(keys[s]), last4: keys[s] ? keys[s].slice(-4) : null }]),
  );
}

export const byokService = {
  status,

  /** Checks and saves the keys given; a service left out keeps its key. */
  async save(workspace, input) {
    const set = {};
    for (const service of BYOK_SERVICES) {
      const key = input[service]?.trim();
      if (!key) continue;
      await check(service, key);
      set[`apiKeys.${service}`] = seal(key);
    }
    if (!Object.keys(set).length) throw fail(422, "Enter at least one key.");
    const updated = await Workspace.findByIdAndUpdate(workspace._id, { $set: set }, { new: true }).lean();
    return status(updated);
  },

  async remove(workspace, service) {
    const updated = await Workspace.findByIdAndUpdate(
      workspace._id,
      { $set: { [`apiKeys.${service}`]: "" } },
      { new: true },
    ).lean();
    return status(updated);
  },
};
