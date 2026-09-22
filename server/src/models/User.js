import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, trim: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", index: true },
    role: { type: String, enum: ["owner", "admin", "member"], default: "owner" },
    lastLoginAt: Date,
    // Bumping this invalidates every outstanding refresh token at once, which
    // is how "sign out everywhere" works without a revocation list.
    tokenVersion: { type: Number, default: 0 },

    // Set by a platform admin. A blocked user cannot sign in, refresh, call
    // the API, or have their avatars answer share links.
    blockedAt: Date,
    blockedReason: { type: String, trim: true },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
