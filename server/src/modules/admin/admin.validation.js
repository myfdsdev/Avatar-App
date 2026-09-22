import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

/** Everything about a plan but its key. Zero minutes or avatars means "no limit". */
const planFields = {
  name: z.string().trim().min(1, "Name is required").max(60),
  description: z.string().trim().max(200).optional(),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  includedMinutes: z.coerce.number().int().min(0).max(1_000_000),
  overageEnabled: z.boolean(),
  concurrencyLimit: z.coerce.number().int().min(1).max(100),
  maxAvatars: z.coerce.number().int().min(0).max(10_000),
  isDefault: z.boolean(),
  active: z.boolean(),
};

export const adminValidation = {
  overview: {
    query: z.object({ tz: z.string().trim().max(64).optional() }),
  },
  listUsers: {
    query: z.object({
      q: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).max(10_000).default(1),
    }),
  },
  byId: { params: z.object({ id: objectId }) },

  block: {
    params: z.object({ id: objectId }),
    body: z.object({ reason: z.string().trim().max(300).optional() }),
  },
  assignPlan: {
    params: z.object({ id: objectId }),
    body: z.object({ planId: objectId }),
  },

  createPlan: {
    body: z
      .object({
        key: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9][a-z0-9-]{1,31}$/, "Use 2-32 lowercase letters, numbers or dashes"),
        ...planFields,
      })
      .partial({
        description: true,
        priceCents: true,
        includedMinutes: true,
        overageEnabled: true,
        concurrencyLimit: true,
        maxAvatars: true,
        isDefault: true,
        active: true,
      })
      .strict(),
  },
  updatePlan: {
    params: z.object({ id: objectId }),
    // The key is fixed once created, so it is not accepted here.
    body: z.object(planFields).partial().strict(),
  },
};
