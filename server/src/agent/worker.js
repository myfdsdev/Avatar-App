import { fileURLToPath } from "node:url";
import { ServerOptions, cli, defineAgent, voice } from "@livekit/agents";
import mongoose from "mongoose";
import { connectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { livekitConfig } from "../integrations/livekit/index.js";
import { Avatar, Conversation } from "../models/index.js";
import { getRenderer } from "./renderers/registry.js";
import { buildPipelineConfig, logPipelineMode } from "./pipeline.js";

/**
 * The realtime worker. One long-lived process, separate from the API, that
 * receives job dispatches from LiveKit and drives a call for its lifetime.
 *
 * It reads the database directly because it needs the avatar's provider,
 * persona and voice for each job - which is why it lives inside server/ and
 * shares models rather than being its own package.
 *
 * Only render-only providers get here. Full-pipeline vendors run the
 * conversation on their own infrastructure and never dispatch to us.
 */
export default defineAgent({
  entry: async (ctx) => {
    if (mongoose.connection.readyState === 0) await connectDb();

    await ctx.connect();

    const { conversation, avatar } = await resolveJob(ctx);
    const renderer = getRenderer(avatar.providerId);
    const pipeline = buildPipelineConfig(avatar);
    logPipelineMode(pipeline);

    // Video first: the avatar should be on screen while the rest warms up,
    // rather than the caller staring at an empty tile.
    await renderer.start({ room: ctx.room, avatar });

    if (!pipeline.available) {
      logger.warn({ room: ctx.room.name }, "video-only mode; no conversation");
      await markActive(conversation);
      // Hold the job open so the track keeps publishing until the caller leaves.
      await new Promise((resolve) => ctx.room.once("disconnected", resolve));
      await renderer.stop();
      return;
    }

    const session = new voice.AgentSession({
      stt: pipeline.stt,
      llm: pipeline.llm,
      tts: pipeline.tts,
    });

    // Keep the placeholder's pulse in step with the agent actually talking.
    session.on("agent_state_changed", (ev) => {
      renderer.setSpeaking?.(ev?.newState === "speaking");
    });

    await session.start({
      agent: new voice.Agent({ instructions: instructionsFor(avatar) }),
      room: ctx.room,
    });

    await markActive(conversation);

    session.generateReply({
      instructions: avatar.persona?.greeting || "Greet the caller warmly in one sentence.",
    });

    ctx.room.once("disconnected", async () => {
      await renderer.stop();
    });
  },
});

/**
 * Finds which conversation this job belongs to.
 *
 * The room name is the link: the API creates the Conversation before minting
 * the token, so by the time a job arrives the record already exists.
 */
async function resolveJob(ctx) {
  const roomName = ctx.room.name;
  const conversation = await Conversation.findOne({ roomName }).lean();
  if (!conversation) throw new Error(`No conversation for room "${roomName}"`);

  const avatar = await Avatar.findById(conversation.avatarId).populate("personaId voiceId").lean();
  if (!avatar) throw new Error(`Avatar ${conversation.avatarId} missing`);

  logger.info(
    { room: roomName, avatar: avatar.name, provider: avatar.providerId },
    "job resolved",
  );
  return {
    conversation,
    avatar: { ...avatar, persona: avatar.personaId, voice: avatar.voiceId },
  };
}

function instructionsFor(avatar) {
  return (
    avatar.persona?.systemPrompt ||
    `You are ${avatar.name}, a friendly AI avatar speaking with someone over video. ` +
      `Keep replies to two or three sentences.`
  );
}

async function markActive(conversation) {
  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { status: "active", startedAt: new Date() } },
  );
}

const cfg = livekitConfig();

// The worker registers under this name; the API dispatches to the same one.
// A mismatch is the usual reason an avatar never joins.
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: env.livekit.agentName,
    wsURL: cfg.url,
    apiKey: cfg.apiKey,
    apiSecret: cfg.apiSecret,
  }),
);
