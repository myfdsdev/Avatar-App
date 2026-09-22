/**
 * Audits every avatar the way a call would, without starting one: provider
 * configured, picture reachable, voice and language model known to the
 * pipeline, knowledge within budget. See agent/preflight.js.
 *
 *   npm --prefix server run check:avatars
 *
 * Exits non-zero when any avatar has something that would stop its calls.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Avatar, KnowledgeDocument } from "../models/index.js";
import { preflight } from "../agent/preflight.js";

await mongoose.connect(env.mongoUri);

const avatars = await Avatar.find().populate("personaId voiceId").populate("workspaceId", "name").lean();
let broken = 0;

console.log(`Checking ${avatars.length} avatar(s)\n`);

for (const avatar of avatars) {
  const documents = await KnowledgeDocument.find({ avatarId: avatar._id }).select("chars").lean();
  const { errors, warnings } = await preflight(
    { ...avatar, persona: avatar.personaId, voice: avatar.voiceId, documents },
    { network: true },
  );
  const where = avatar.workspaceId?.name ? ` (${avatar.workspaceId.name})` : "";
  console.log(`  ${errors.length ? "FAIL" : "ok  "} ${avatar.name}${where} - ${avatar.providerId}`);
  for (const e of errors) console.log(`         x ${e}`);
  for (const w of warnings) console.log(`         ! ${w}`);
  if (errors.length) broken += 1;
}

console.log(`\n${avatars.length - broken} ready, ${broken} with problems`);
await mongoose.disconnect();
process.exit(broken ? 1 : 0);
