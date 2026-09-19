import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const roomValidation = {
  start: { body: z.object({ avatarId: objectId }) },
  end: { params: z.object({ conversationId: objectId }) },
};
