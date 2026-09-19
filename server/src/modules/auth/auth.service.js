import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Subscription, User, Workspace } from "../../models/index.js";
import { env } from "../../config/env.js";

const ROUNDS = 12;

/**
 * Registration, sign-in and token issuance.
 *
 * Access tokens are short-lived and carry the workspace, so every request can
 * be scoped without a database read. Refresh tokens are long-lived and are the
 * only thing that can mint a new access token, so a leaked access token expires
 * on its own.
 *
 * Refresh tokens carry a version number that is stored on the user. Bumping it
 * invalidates every outstanding refresh token at once, which is what makes
 * "sign out everywhere" and post-compromise recovery possible without keeping
 * a revocation list.
 */
export const authService = {
  async register({ email, password, name, workspaceName }) {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      // Deliberately the same shape as any other validation failure. Telling a
      // stranger which addresses are registered is an account-enumeration gift.
      throw conflict("That email cannot be used");
    }

    const user = await User.create({
      email,
      passwordHash: await bcrypt.hash(password, ROUNDS),
      name,
      role: "owner",
    });

    const workspace = await Workspace.create({
      name: workspaceName || `${name || email.split("@")[0]}'s workspace`,
      ownerId: user._id,
    });

    user.workspaceId = workspace._id;
    await user.save();

    await Subscription.create({ workspaceId: workspace._id, plan: "free", status: "active" });

    return { user: publicUser(user), workspace, ...issueTokens(user) };
  },

  async login({ email, password }) {
    // passwordHash is select:false, so it has to be asked for explicitly.
    const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");

    // Hash a dummy password when the user is missing so the response time does
    // not reveal whether the address exists.
    const hash = user?.passwordHash || DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok) throw unauthorized("Incorrect email or password");

    user.lastLoginAt = new Date();
    await user.save();

    return { user: publicUser(user), ...issueTokens(user) };
  },

  async refresh(refreshToken) {
    let claims;
    try {
      claims = jwt.verify(refreshToken, env.jwt.refreshSecret);
    } catch {
      throw unauthorized("Invalid refresh token");
    }

    const user = await User.findById(claims.sub);
    if (!user) throw unauthorized("Invalid refresh token");

    // A version mismatch means every token issued before a revoke is dead.
    if ((user.tokenVersion || 0) !== claims.ver) {
      throw unauthorized("Refresh token has been revoked");
    }

    return { user: publicUser(user), ...issueTokens(user) };
  },

  /** Invalidates every outstanding refresh token for this user. */
  async revokeAll(userId) {
    await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  },
};

function issueTokens(user) {
  const payload = {
    sub: String(user._id),
    wsp: String(user.workspaceId || ""),
    role: user.role,
  };

  return {
    accessToken: jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl }),
    refreshToken: jwt.sign(
      { sub: payload.sub, ver: user.tokenVersion || 0 },
      env.jwt.refreshSecret,
      { expiresIn: env.jwt.refreshTtl },
    ),
  };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

const publicUser = (user) => ({
  id: String(user._id),
  email: user.email,
  name: user.name,
  role: user.role,
  workspaceId: user.workspaceId ? String(user.workspaceId) : null,
});

// Cost-matched placeholder so a login for a missing account still does the work.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), ROUNDS);

function unauthorized(message) {
  const err = new Error(message);
  err.statusCode = 401;
  return err;
}

function conflict(message) {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
}
