# conversations

Call history and transcripts, read-only.

Transcripts are written by the agent worker (`agent/transcript.recorder.js`),
one turn at a time as the call happens, so this module only reads them. Only
render-only calls have one: full-pipeline vendors host the conversation
themselves and nothing passes through our worker.
