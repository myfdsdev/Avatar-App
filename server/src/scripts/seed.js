/**
 * Creates the minimum a fresh install needs to make a call: one workspace, one
 * user, a persona, a voice, and a ready-to-call mock avatar.
 *
 * Idempotent - safe to run repeatedly.
 *
 *   npm --prefix server run seed
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../config/db.js";
import { Avatar, Persona, Subscription, User, Voice, Workspace } from "../models/index.js";

// Development credentials. Printed on seed so there is no need for an auth
// bypass in the middleware just to click around locally.
export const DEMO_EMAIL = "demo@example.com";
export const DEMO_PASSWORD = "demo-password-123";

const DEMO_IMAGE =
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=640&h=640&fit=crop";

export async function seed() {
  let workspace = await Workspace.findOne({ name: "Demo workspace" });

  if (!workspace) {
    const owner = await User.create({
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      name: "Demo user",
      role: "owner",
    });

    workspace = await Workspace.create({
      name: "Demo workspace",
      ownerId: owner._id,
      settings: { defaultProviderId: "mock" },
    });

    owner.workspaceId = workspace._id;
    await owner.save();

    // Registration creates one; the seed has to as well, or the demo workspace
    // looks unplanned to anything that reads billing state.
    await Subscription.create({ workspaceId: workspace._id, plan: "free", status: "active" });
  }

  const persona = await upsert(Persona, { workspaceId: workspace._id, name: "Friendly guide" }, {
    systemPrompt:
      "You are a warm, concise guide demonstrating an AI avatar platform. " +
      "Keep answers to two or three sentences and sound like a person, not a brochure.",
    greeting: "Say hello and ask what they would like to try.",
    llmModel: "claude-sonnet-5",
  });

  const voice = await upsert(Voice, { workspaceId: workspace._id, name: "Demo voice" }, {
    provider: "mock",
    providerVoiceId: "mock-voice-1",
    language: "en",
  });

  const avatar = await upsert(Avatar, { workspaceId: workspace._id, name: "Demo avatar" }, {
    sourceType: "photo",
    status: "ready",
    providerId: "mock",
    providerAvatarId: "mock_av_seed",
    previewUrl: DEMO_IMAGE,
    personaId: persona._id,
    voiceId: voice._id,
  });

  return { workspace, persona, voice, avatar };
}

async function upsert(Model, query, defaults) {
  const existing = await Model.findOne(query);
  if (existing) return existing;
  return Model.create({ ...query, ...defaults });
}

// Only run when invoked directly, so tests can import seed() without side effects.
const invokedDirectly =
  process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  connectDb()
    .then(seed)
    .then(({ workspace, avatar }) => {
      console.log(`Seeded workspace "${workspace.name}"`);
      console.log(`Avatar "${avatar.name}" (${avatar._id}) is ready to call`);
      console.log("");
      console.log(`Sign in with  ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}`);
      return disconnectDb();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed failed:", err.message);
      mongoose.connection.close().finally(() => process.exit(1));
    });
}
