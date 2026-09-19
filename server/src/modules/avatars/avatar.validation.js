import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const avatarValidation = {
  byId: { params: z.object({ id: objectId }) },
};
