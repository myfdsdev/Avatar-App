import { z } from "zod";

const source = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  // Omitted means "let the registry pick the cheapest capable vendor".
  providerId: z.string().trim().min(1).optional(),
});

export const studioValidation = {
  createFromStock: {
    body: z.object({
      providerId: z.string().trim().min(1),
      providerAvatarId: z.string().trim().min(1),
      // Optional: falls back to the vendor's own name for the avatar.
      name: z.string().trim().max(80).optional(),
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
