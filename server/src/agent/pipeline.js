import { inference } from "@livekit/agents";
import * as anthropic from "@livekit/agents-plugin-anthropic";
import { livekitConfig } from "../integrations/livekit/index.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * Builds the speech and language half of a call.
 *
 * Two independent credentials decide what is possible, and neither implies the
 * other:
 *
 *   LiveKit Cloud    provides Inference - hosted STT and TTS behind the LiveKit
 *                    credential. The self-hosted server does NOT offer it, so
 *                    without Cloud there is no speech at all.
 *
 *   Anthropic key    LiveKit Inference does not carry Claude. Claude is only
 *                    reachable through its own plugin with your own key, so the
 *                    language model is chosen separately from speech.
 *
 * Rather than fail when something is missing, the worker degrades and reports
 * what it degraded to - a mute agent with no explanation is far worse to debug
 * than a loud one.
 *
 * @param {{ voice?: { providerVoiceId?: string, language?: string } }} [avatar]
 */
export function buildPipelineConfig(avatar) {
  const persona = avatar?.persona;
  const cfg = livekitConfig();

  if (cfg.isDev) {
    return {
      available: false,
      reason:
        "LiveKit Inference requires LiveKit Cloud, and this is the self-hosted dev server. " +
        "The agent will publish avatar video without conversation. " +
        "Set LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET to enable speech.",
    };
  }

  const llm = buildLlm(persona);
  const tts = buildTts(avatar);
  const language = persona?.language || env.sttLanguage;

  return {
    available: true,
    stt: new inference.STT({ model: env.sttModel, language }),
    tts: tts.instance,
    llm: llm.instance,
    llmLabel: llm.label,
    ttsLabel: tts.label,
    notes: [llm.note, tts.note].filter(Boolean),
  };
}

/**
 * The persona's model and temperature win over the install defaults.
 *
 * They were stored from the start and then ignored here, so a brief that asked
 * for a different model or a steadier tone quietly got neither.
 */
function buildLlm(persona) {
  if (env.anthropicApiKey) {
    const model = persona?.llmModel || env.defaultLlmModel;
    return {
      instance: new anthropic.LLM({
        model,
        apiKey: env.anthropicApiKey,
        temperature: persona?.temperature,
      }),
      label: model,
    };
  }

  return {
    instance: new inference.LLM({ model: env.fallbackLlmModel }),
    label: env.fallbackLlmModel,
    note:
      `No ANTHROPIC_API_KEY, so using the hosted model "${env.fallbackLlmModel}". ` +
      `LiveKit Inference does not carry Claude.`,
  };
}

/**
 * Inference TTS requires a voice alongside the model - omitting it fails at
 * call time, not at construction. The avatar's own voice wins when one is set,
 * so a per-avatar voice needs no change here once Phase 2 populates it.
 */
function buildTts(avatar) {
  const voice = avatar?.voice?.providerVoiceId || env.ttsVoice;
  const language = avatar?.persona?.language || avatar?.voice?.language || env.sttLanguage;

  return {
    instance: new inference.TTS({ model: env.ttsModel, voice, language }),
    label: `${env.ttsModel} / ${voice}`,
    note: avatar?.voice?.providerVoiceId
      ? null
      : `Avatar has no voice assigned; using the default "${voice}".`,
  };
}

export function logPipelineMode(config) {
  if (!config.available) {
    logger.warn({ reason: config.reason }, "pipeline: video only");
    return;
  }
  logger.info({ llm: config.llmLabel, tts: config.ttsLabel }, "pipeline: full conversation");
  for (const note of config.notes || []) logger.warn(note);
}
