# Avatar providers

## Capability matrix

Mirrors `server/src/avatar/capabilities.js`. That file is the source of truth;
this table is for reading.

| Provider | Shape | Transport | Photo | Video clone | BYO LLM | Emotions | Live image swap | Node plugin | ~$/min |
|---|---|---|---|---|---|---|---|---|---|
| **mock** | render-only | livekit | yes | yes | yes | no | no | **yes** | 0 |
| **LemonSlice 2.1** | render-only | livekit | yes | no | yes | yes | yes | **yes** | 0.164 |
| **Tavus CVI** | full-pipeline | daily | no | yes | yes | no | no | **yes** | 0.37 |
| Simli Trinity-1 | render-only | livekit | yes | no | yes | no | no | **no** | 0.01 |
| HeyGen LiveAvatar | render-only | livekit | yes | yes | LITE only | no | no | **no** | 0.10 |

## Why these two

Photo avatars and video clones are different products and few vendors do both
well. LemonSlice covers photo, Tavus covers video clone, and both ship LiveKit
**Node** plugins - which is a hard requirement here.

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

## Per-provider notes

### LemonSlice — photo avatars

**There is no avatar to create.** LemonSlice takes the image URL at session
time and animates it on the fly - no training step, and no vendor-side object
to register, update or delete. `LemonSliceProvider.createFromPhoto` therefore
makes no API call at all: it validates that the image is something LemonSlice
can actually fetch, and the URL itself becomes the `providerAvatarId`.

That validation is the method's entire value. The most common way this
integration fails is handing LemonSlice a URL its servers cannot reach - a
localhost address, a private host, a 404 - which would otherwise surface
minutes later as a call that never produces video.

**It does not need public storage.** The plugin takes `agentImage` as a Buffer
as readily as `agentImageUrl`, and the control endpoint takes `image_base64` as
readily as `image_url`. The renderer checks whether the image is on a private
host and sends bytes when it is, so LemonSlice works on a laptop with
`STORAGE_DRIVER=local` while Tavus does not. That distinction is the
`acceptsDirectUpload` flag in the capability matrix.

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
- Self-serve from $8/mo; `approxCostPerMinUsd` above reflects the entry tier.
- Sign up: https://lemonslice.com/developers

### Tavus — trained faces

**Terminology moved.** What older material calls a *replica* is now a **face**,
and a *persona* is now a **PAL**. The endpoints are `/v2/faces` and `/v2/pals`;
auth is the `x-api-key` header, not a bearer token.

- Trains a face from a video (`train_video_url`) **or a still**
  (`train_image_url`). A still additionally requires a voice, because there is
  no audio to learn one from - hence `TAVUS_DEFAULT_VOICE`.
- Training is genuinely asynchronous. `POST /v2/faces` returns
  `{ face_id, status }` where status is `started`, and the face is unusable
  until it reaches `ready`.
- The face **is** the job: there is no separate job resource, so `face_id`
  serves as both the job id and the eventual avatar id.
- **Full-pipeline, on Daily rather than LiveKit.** `POST /v2/conversations`
  returns a `conversation_url` like `https://tavus.daily.co/c123` which the
  browser joins directly. No renderer exists for Tavus and our agent worker
  never runs - this is the main reason the adapter has two shapes.
- Free tier is 25 conversation minutes; paid from $59/mo, overage ~$0.37/min.
- Sign up: https://platform.tavus.io

#### Tavus webhooks are unsigned

Tavus documents no signature, HMAC or shared secret on its callbacks. Anyone
who learns a callback URL can POST a convincing "training finished".

Two things make that harmless, and both matter:

1. The callback URL carries an HMAC of the job id
   (`/api/webhooks/providers/tavus/<jobId>.<mac>`), so an attacker cannot
   address a job they do not already know about.
2. **The payload is never written.** A webhook only prompts a fresh read from
   the vendor, so even a perfectly forged call cannot set a status.

Point 2 is the one that actually holds. See `avatar/training.service.js`, and
the two tests in `tests/integration/training.test.js` that pin the behaviour.

## Gotchas

**Assets must be publicly reachable.** Both vendors fetch images and videos from
their own infrastructure. `localhost`, private addresses and short-lived signed
URLs all fail. Upload to public object storage first.

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
3. Register a factory in `providers/registry.js`.
4. If render-only, add `server/src/agent/renderers/<name>.renderer.js`
   extending `BaseAvatarRenderer`.
5. Add credentials to `server/.env.example`.

No caller should need to change. If one does, the interface needs fixing first.
