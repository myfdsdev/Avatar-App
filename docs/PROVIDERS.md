# Avatar providers

## Capability matrix

Mirrors `server/src/avatar/capabilities.js`. That file is the source of truth;
this table is for reading.

| Provider | Shape | Transport | Photo | Video clone | Ready-made | BYO LLM | Takes bytes | Node plugin | ~$/min |
|---|---|---|---|---|---|---|---|---|---|
| **mock** *(stub)* | render-only | livekit | yes | yes | no | yes | yes | yes | 0 |
| **mock-hosted** *(stub)* | full-pipeline | daily | yes | yes | yes | no | yes | yes | 0 |
| **LemonSlice 2.1** | render-only | livekit | yes | no | no | yes | **yes** | **yes** | 0.164 |
| Simli Trinity-1 | render-only | livekit | yes | no | no | yes | no | **no** | 0.01 |
| HeyGen LiveAvatar | render-only | livekit | yes | yes | yes | LITE only | no | **no** | 0.10 |

The two stubs are development tooling. They never win automatic selection and
are hidden from the studio unless `AVATAR_PROVIDER` explicitly names one.

## Current state

**LemonSlice is the only real vendor implemented.** It covers photo avatars.
There is no real vendor for video clones or ready-made avatars at present, so
the client offers photo only: "Create" opens a single dialog (photo + brief).
The server's `/studio/video` and `/studio/stock` endpoints remain, so bringing
either source back is client work only.

Tavus was previously integrated for video clones and ready-made faces. It was
removed; the adapter is in git history if it is wanted back. The full-pipeline
architecture it motivated was kept, because it is vendor-neutral and
`mock-hosted` keeps it exercised.

## The Node plugin constraint

LiveKit ships avatar plugins for both Python and Node for only about half its
integrations:

| Python + Node | Python only |
|---|---|
| Anam, Beyond Presence, D-ID, LemonSlice, Protoface, Runway, Tavus, TruGen | Avatario, AvatarTalk, bitHuman, Keyframe, **LiveAvatar (HeyGen)**, **Simli**, Spatius, Synthesia |

Simli is the cheapest option in the market by a wide margin and HeyGen is the
strongest video-clone product, so losing both is a real cost of staying on a
single-runtime stack. Three ways back if that cost bites:

1. Integrate their own JavaScript SDKs directly, bypassing the LiveKit plugin.
   Most work, keeps the stack pure.
2. Run a small Python sidecar worker only for those vendors. Two runtimes to
   deploy.
3. Contribute Node plugins upstream. LiveKit accepts them.

The adapter interface accommodates all three without changes to callers.

## LemonSlice — photo avatars

**There is no avatar to create.** LemonSlice takes the image at session time
and animates it on the fly - no training step, and no vendor-side object to
register, update or delete. `LemonSliceProvider.createFromPhoto` therefore
makes no API call at all: it validates that the image is readable, and the URL
itself becomes the `providerAvatarId`.

That validation is the method's entire value. The most common way this
integration fails is an image that cannot be read, which would otherwise
surface minutes later as a call that never produces video.

**It does not need public storage.** The plugin takes `agentImage` as a Buffer
as readily as `agentImageUrl`, and the control endpoint takes `image_base64` as
readily as `image_url`. The renderer checks whether the image is on a private
host and sends bytes when it is, so LemonSlice works on a laptop with
`STORAGE_DRIVER=local`. That is the `acceptsDirectUpload` flag in the matrix.

**No key, no avatar.** Because nothing is registered on LemonSlice's side,
creation would succeed without a key and the avatar would only fail when
dialled. `isConfigured()` in the registry stops that - an unconfigured vendor is
never offered.

- Image-to-avatar from a single still, no training. Handles non-human and
  cartoon subjects, which most vendors do not.
- ~471ms p99 quoted; Flash tier is faster and enterprise-only.
- Emotions and mid-call image swaps are supported, but **not through the
  LiveKit plugin** - it exposes neither. They are POSTs to
  `https://lemonslice.com/api/liveai/sessions/{id}/control` with an `X-API-Key`
  header, addressed by the session id `start()` returns:

  | Event | Purpose |
  |---|---|
  | `pose-trigger` | What the marketing calls emotions - a named pose |
  | `update-image` | Swap the reference image mid-call, <1s |
  | `update-agent-prompt` / `update-idle-prompt` | Retune movement |
  | `reset-idle-timeout` | Keep a quiet session alive |
  | `terminate` | End it |

  Note the plugin's shutdown method is `aclose()`, not `close()`.
- `agentPrompt` steers movement, not speech. It comes from the persona's
  **Demeanour** field; the conversational brief goes to the language model.
- Self-serve from $8/mo; `approxCostPerMinUsd` above reflects the entry tier.
- Sign up: https://lemonslice.com/developers

## Webhooks

Vendors are not assumed to sign their callbacks, and at least one previously
integrated vendor did not. Anyone who learns a callback URL could then POST a
convincing "training finished".

Two things make that harmless:

1. The callback URL carries an HMAC of the job id
   (`/api/webhooks/providers/<provider>/<jobId>.<mac>`), so an attacker cannot
   address a job they do not already know about.
2. **The payload is never written.** A webhook only prompts a fresh read from
   the vendor, so even a perfectly forged call cannot set a status.

Point 2 is the one that actually holds. See `avatar/training.service.js` and the
tests in `tests/integration/training.test.js`.

## Gotchas

**Some vendors fetch assets themselves.** Those cannot be pointed at
`localhost`, a private address or a short-lived signed URL. The studio refuses
that combination and names the fix. No currently implemented real vendor is in
this category - LemonSlice takes the bytes - but the guard is tested so it holds
for the next one.

**Video clone training is asynchronous** and takes minutes. Never block a
request on it - create a `TrainingJob`, return, and resolve by webhook or poll.

**Latency is mostly not the vendor's.** For render-only vendors the avatar adds
its quoted figure on top of STT, LLM and TTS. A slow language model dominates
the number the user actually feels.

**Cost figures are for planning only.** They are not a billing source; real
spend is reconciled into `UsageLedger` from actual call duration.

## Adding a provider

1. Add an entry to `CAPABILITIES` in `server/src/avatar/capabilities.js`.
2. Create `server/src/avatar/providers/<name>.provider.js` extending
   `BaseAvatarProvider`. Implement only what the capability entry claims.
3. Register a factory and a credential check in `providers/registry.js`.
4. If render-only, add `server/src/agent/renderers/<name>.renderer.js`
   extending `BaseAvatarRenderer`. If full-pipeline, implement `createSession`
   and `endSession` on the provider instead.
5. Add credentials to `server/.env.example`.

No caller should need to change. If one does, the interface needs fixing first.
