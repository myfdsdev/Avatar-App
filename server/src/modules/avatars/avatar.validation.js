import { z } from "zod";
import { behaviourFields, gender } from "../studio/studio.validation.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const avatarValidation = {
  byId: { params: z.object({ id: objectId }) },
  update: {
    params: z.object({ id: objectId }),
    body: z
      .object({
        name: z.string().trim().min(1, "Name is required").max(80).optional(),
        gender: gender.optional(),
        render: z
          .object({
            aspectRatio: z.enum(["2x3", "9x16", "1x1"]).optional(),
            model: z.enum(["standard", "flash", "lite"]).optional(),
          })
          .optional(),
        // A blank clears the call-length cap back to the install default.
        persona: behaviourFields
          .extend({ maxCallSeconds: behaviourFields.shape.maxCallSeconds.or(z.literal("")) })
          .optional(),
      })
      .strict(),
  },
  setShare: {
    params: z.object({ id: objectId }),
    body: z.object({ enabled: z.boolean() }),
  },
};
