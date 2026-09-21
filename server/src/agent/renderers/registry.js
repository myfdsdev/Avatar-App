import { MockAvatarRenderer } from "./mock.renderer.js";
import { LemonSliceRenderer } from "./lemonslice.renderer.js";
import { env } from "../../config/env.js";

/**
 * Runtime counterpart to avatar/providers/registry.js.
 *
 * Only render-only vendors appear here. Full-pipeline vendors never
 * reach the agent worker at all - the client connects straight to them - so
 * they have no renderer by design, not by omission.
 */
const FACTORIES = {
  mock: () => new MockAvatarRenderer(),
  lemonslice: () => new LemonSliceRenderer({ apiKey: env.lemonsliceApiKey }),
};

export function getRenderer(providerId) {
  const factory = FACTORIES[providerId];
  if (!factory) {
    throw new Error(
      `No renderer for provider "${providerId}". Available: ${Object.keys(FACTORIES).join(", ")}`,
    );
  }
  return factory();
}

export const implementedRendererIds = () => Object.keys(FACTORIES);
