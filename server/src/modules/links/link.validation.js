import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
// base64url of 16 random bytes is 22 characters; the range leaves room to
// lengthen tokens later without breaking links already sent.
const token = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Invalid link");

export const linkValidation = {
  describe: { params: z.object({ token }) },
  start: {
    params: z.object({ token }),
    body: z.object({
      name: z.string().trim().min(1, "Please enter your name").max(80),
      email: z
        .string()
        .trim()
        .max(200)
        .email("That email does not look right")
        .optional()
        .or(z.literal("").transform(() => undefined)),
    }),
  },
  end: {
    params: z.object({ token, conversationId: objectId }),
    body: z.object({ callToken: z.string().min(16).max(200) }),
  },
};
