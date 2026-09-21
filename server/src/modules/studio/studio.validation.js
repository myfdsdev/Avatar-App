import { z } from "zod";

/**
 * How the avatar should behave. Every field optional - there are defaults.
 *
 * Nested under one key so the three create flows forward it as a unit and
 * cannot drift apart on which fields they happen to pass through.
 */
const behaviour = z.preprocess(
  // The upload flows are multipart, so this arrives as a JSON string there and
  // as an object on the JSON route. Normalise before validating rather than
  // giving the two routes different schemas.
  (value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },
  z
    .object({
      systemPrompt: z.string().trim().max(4000).optional(),
      greeting: z.string().trim().max(400).optional(),
      language: z.string().trim().min(2).max(10).optional(),
      temperature: z.coerce.number().min(0).max(2).optional(),
      motionPrompt: z.string().trim().max(400).optional(),
      maxCallSeconds: z.coerce.number().int().min(60).max(14400).optional(),
    })
    .optional(),
);

const source = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  // Omitted means "let the registry pick the cheapest capable vendor".
  providerId: z.string().trim().min(1).optional(),
  behaviour,
});

export const studioValidation = {
  createFromStock: {
    body: z.object({
      providerId: z.string().trim().min(1),
      providerAvatarId: z.string().trim().min(1),
      // Optional: falls back to the vendor's own name for the avatar.
      name: z.string().trim().max(80).optional(),
      behaviour,
    }),
  },
  createFromVideo: { body: source },
  createFromPhoto: {
    body: z.object({
      name: z.string().trim().min(1, "Name is required").max(80),
      // Omitted means "let the registry pick the cheapest capable vendor".
      providerId: z.string().trim().min(1).optional(),
    }),
  },
};
