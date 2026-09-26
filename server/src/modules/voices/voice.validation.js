import { z } from "zod";
import { isCustomVoice } from "../../ai/catalog.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const voiceValidation = {
  create: {
    body: z.object({
      name: z.string().trim().min(1, "Give the voice a name").max(60),
      voiceId: z
        .string()
        .trim()
        .refine(isCustomVoice, "Paste the voice ID from LiveKit Cloud - it starts with v_"),
      gender: z.enum(["female", "male"]).optional(),
      language: z.string().trim().min(2).max(10).optional(),
    }),
  },
  remove: { params: z.object({ voiceId: objectId }) },
};
