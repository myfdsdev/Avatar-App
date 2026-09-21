import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const conversationValidation = {
  list: { query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(100) }) },
  byId: { params: z.object({ id: objectId }) },
};
