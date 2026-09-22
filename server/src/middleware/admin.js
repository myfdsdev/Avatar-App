import { User } from "../models/index.js";
import { env } from "../config/env.js";

/** Whether an email is on the ADMIN_EMAILS list. */
export const isPlatformAdmin = (email) =>
  Boolean(email) && env.adminEmails.includes(String(email).toLowerCase());

/**
 * Lets platform admins through; everyone else gets a 403.
 *
 * Checked against the user's current email on every request, not a token
 * claim, so removing someone from ADMIN_EMAILS takes effect at once.
 */
export async function requirePlatformAdmin(req, res, next) {
  try {
    const user = await User.findById(req.auth?.userId).select("email").lean();
    if (!user || !isPlatformAdmin(user.email)) {
      const err = new Error("Admin access required");
      err.statusCode = 403;
      throw err;
    }
    req.admin = user;
    next();
  } catch (err) {
    next(err);
  }
}
