/**
 * Test environment, set before anything reads it.
 *
 * ESM evaluates imports before the importing module's body, so assigning to
 * process.env inside a test file is too late - config/env.js has already been
 * evaluated by then. Importing this module first is the only ordering that
 * actually works.
 */
process.env.NODE_ENV = "test";
process.env.WEBHOOK_SECRET ||= "test-secret-not-a-real-one";
process.env.STORAGE_DRIVER ||= "local";
process.env.AVATAR_PROVIDER ||= "mock";

// Independent of whatever is in the developer's .env, so a local LiveKit or
// Anthropic key cannot change what the suite exercises.
process.env.LIVEKIT_URL = "";
process.env.LIVEKIT_API_KEY = "";
process.env.LIVEKIT_API_SECRET = "";
process.env.ANTHROPIC_API_KEY = "";

// Vendor credentials are pinned rather than cleared, so the suite always has
// one configured vendor and one unconfigured one to assert against - whatever
// the developer happens to have in .env.
process.env.TAVUS_API_KEY = "test-tavus-key";
process.env.LEMONSLICE_API_KEY = "";
