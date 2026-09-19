# Architecture

## What this is

An interactive AI avatar platform: a user uploads a photo or records a video,
gets a talking avatar, and holds a real-time voice conversation with it in the
browser. Comparable to LemonSlice and HeyGen.

## The constraint that shaped everything

Avatar video generation is not done here. There is no GPU in this stack and no
model is self-hosted, so every avatar frame comes from a third-party vendor over
the network. The product's job is everything around that: identity, avatar
lifecycle, persona, conversation orchestration, transcripts, usage and billing.

This makes vendor independence the central architectural concern. If a vendor
raises prices, degrades, or disappears, the product must survive it. Hence the
provider abstraction described below.

## Two planes

The system splits along a line that is easy to miss and expensive to get wrong.

**Control plane** - creating, training, listing and deleting avatars. Ordinary
request/response work owned by the Express API. Lives in `server/src/avatar/`.

**Data plane** - driving an avatar during a live call. A long-lived job inside a
separate LiveKit agent worker process. Lives in `server/src/agent/`.

They are separate because their lifetimes differ. An API request lasts
milliseconds; a call lasts minutes and must survive an API deploy. Collapsing
them would tie a user's call to the API process restarting.

Each plane has its own contract:

| Plane | Contract | File |
|---|---|---|
| Control | `BaseAvatarProvider` | `server/src/avatar/providers/base.provider.js` |
| Data | `BaseAvatarRenderer` | `server/src/agent/renderers/base.renderer.js` |

## Vendors come in two shapes

This is the single most important thing to understand before touching the
adapter layer.

**Render-only** (LemonSlice, Simli, HeyGen LiveAvatar, Anam, D-ID)
We run the conversation. Speech-to-text, the language model and text-to-speech
are ours; the vendor receives our audio and returns lip-synced video. We control
latency, model choice and cost, and we can swap any piece independently.

```
mic -> STT -> LLM -> TTS -> [vendor renders video] -> browser
                              ^ our agent worker drives this
```

**Full-pipeline** (Tavus CVI, HeyGen FULL mode)
The vendor runs the entire conversation on their infrastructure. Our agent
worker is not involved at all. The API creates a session and the browser
connects directly to the vendor's transport.

```
mic -> [vendor runs STT + LLM + TTS + video] -> browser
        ^ we only create the session
```

A naive single-method adapter cannot express both. That is why
`Conversation.pipelineMode` and `Conversation.transport` are stored on the
record rather than derived: the client must know how to connect before it can
render anything, and the answer depends on which vendor served that specific
call.

## Capability matrix, not conditionals

`server/src/avatar/capabilities.js` holds what each vendor can do as plain data.
Both the server and the client read it. An unsupported combination - asking a
photo-only vendor for a video clone - is therefore not selectable in the UI
rather than failing at the vendor's API.

`registry.js` routes on that data. Adding a vendor is one new file plus one
registry entry. If it ever requires editing a caller, the interface is wrong.

A second flag matters for this codebase specifically: `nodePlugin`. LiveKit
ships Node plugins for roughly half of its avatar integrations. Simli and HeyGen
LiveAvatar are Python-only and cannot be driven from this Node server. They are
present in the matrix, marked unusable, so the gap stays visible.

## Assets must be publicly reachable

Vendors fetch avatar images and training videos from their own servers. A
`localhost` URL, a private network address or a short-lived signed URL will
fail. Uploads therefore go to object storage with public read URLs *before* an
avatar is created, not as a later optimisation. `AvatarAsset.publicUrl` exists
for this reason.

## Storage is an adapter too

`server/src/integrations/storage/` follows the same shape as the vendor
adapters, for the same reason: the choice is deployment-specific and should not
leak into callers.

| Driver | Where | Publicly fetchable |
|---|---|---|
| `local` | `./uploads`, served by Express | no - localhost |
| `r2` | Cloudflare R2 | yes |

The `reachableByVendors` flag is what makes the constraint enforceable. The
studio service refuses the combination of a real vendor and a driver that
cannot produce a public URL, and says which setting fixes it - rather than
uploading, calling the vendor, and failing on a URL it could never fetch.

Ordering follows from this: store the asset and get its public URL *before*
calling the vendor. Register-then-upload is the intuitive sequence and does not
work.

## Two reasons a vendor can be unusable

They need different fixes, so they are tracked separately rather than collapsed
into one "unavailable" flag:

**No credential.** `isConfigured()` in the provider registry. This matters more
than it looks: LemonSlice registers nothing on its side, so `createFromPhoto`
succeeds without a key and the avatar only fails when someone dials it. Without
this check the product happily manufactures dead avatars.

**Storage it cannot reach.** `acceptsDirectUpload` in the capability matrix.
Most vendors fetch assets from their own servers and therefore need public
object storage; LemonSlice will take the bytes, so it works with
`STORAGE_DRIVER=local` and Tavus will not.

Both surface in the studio with the specific fix named, and `Avatar.callable`
accounts for both.

## Call lifecycle

Render-only:

1. Client asks the API for a room.
2. API creates a `Conversation` (`pipelineMode: render-only`), mints a LiveKit
   token and requests agent dispatch.
3. Client joins the LiveKit room.
4. The agent worker receives the job, builds the STT/LLM/TTS pipeline, and
   starts the renderer for that avatar's vendor.
5. Vendor publishes video into the room.
6. On disconnect, a worker writes duration and cost to `UsageLedger`.

Full-pipeline:

1. Client asks the API for a room.
2. API calls the vendor's `createSession()` and stores the returned session id
   and transport on the `Conversation`.
3. Client connects directly to the vendor's transport. No agent worker runs.
4. Usage is reconciled from the vendor's webhook rather than from room events.

## Speech is two credentials, not one

LiveKit Inference bundles hosted STT and TTS behind the LiveKit credential, but
it does not carry Anthropic models. Claude is reachable only through its own
plugin with a separate key. The pipeline therefore resolves speech and language
independently, and reports which path it took rather than silently producing a
mute or unexpected agent. Self-hosted LiveKit offers no Inference at all, so
that path is video-only by construction.

See `server/src/agent/pipeline.js`.

## Asynchronous training

Video-cloned faces take minutes to train, so `createFromVideo` returns a job
and the avatar sits in `training` until it resolves. Two paths resolve it, and
keeping both is deliberate:

**Webhook** - fast, but not trustworthy on its own. Tavus sends no signature,
and a callback can simply be missed during a deploy.

**Polling** - authoritative. Runs lazily whenever someone reads a training
avatar, which is exactly when the answer matters, so a missed webhook costs a
few seconds rather than leaving an avatar stuck forever.

The webhook never carries the outcome. It only says "go and look", and the
status always comes from a fresh vendor read. That single decision is what
makes an unsigned, forgeable callback safe to accept at all.

Lazy polling also means correctness does not depend on Redis being up. A queue
worker for proactive reconciliation is an optimisation, not a requirement.

## Running without credentials

The default provider is `mock`. It implements the full interface, resolves photo
avatars immediately and takes about ten seconds for a video clone so the
asynchronous training path, job polling and webhook handling are exercised for
real in development. A fresh clone runs end to end with no vendor account.

This is not a test double added afterwards - it is the reference implementation
of the contract.

## Running the worker

The agent worker is a CLI, not a plain script: `node src/agent/worker.js` with
no subcommand prints help and exits. It needs `dev` or `start`, which is what
`npm run agent` and `npm run agent:start` pass.

Two operational notes that cost real debugging time:

**Stale workers steal jobs.** Every worker registered under the same
`AGENT_NAME` is a dispatch candidate. Killing the npm wrapper does not kill the
node process underneath, so an orphan keeps accepting jobs and running old
code, while the new worker sits idle. If dispatch goes somewhere unexpected,
check for more than one `worker.js` process before suspecting the code.

**Each job runs in a forked subprocess.** On a memory-constrained machine that
fork fails with `STATUS_DLL_INIT_FAILED` (exit 3221225794) and the agent never
joins, with nothing wrong in the application at all.

## Process topology

| Process | Command | Responsibility |
|---|---|---|
| API | `npm --prefix server run dev` | HTTP, auth, avatar CRUD, token minting |
| Agent worker | `npm --prefix server run agent` | Live calls (render-only vendors) |
| Queue workers | `npm --prefix server run workers` | Training polls, media, transcripts, usage |
| Client | `npm --prefix client run dev` | React SPA |

All share `server/src/models` and `server/src/config`, which is why the agent
lives inside `server/` rather than as a separate package.

Note the distinction between `server/src/agent/` and `server/src/workers/`: the
former is one long-lived realtime process fed by LiveKit dispatch, the latter
are BullMQ consumers fed by Redis.

## Metering and the two clocks

Cost is computed from the duration actually observed, never from
`approxCostPerMinUsd` - that figure exists to route and forecast, and billing
from it would drift the moment a vendor changed price mid-month. The ledger is
append-only and idempotent per conversation, so a hang-up request and a
transport disconnect event landing together cannot double-bill.

The subtle part is when the clock starts, and it differs by vendor shape:

**Render-only** - the agent worker marks the call active when it joins, because
nothing is being consumed until then.

**Full-pipeline** - no worker runs, and the vendor begins charging the moment
the session exists. The clock therefore starts at session creation. Measuring
these from "active" would meter every hosted call as zero minutes while the
vendor's invoice kept climbing.

`mock-hosted` exists so that branch is testable: it is the full-pipeline
counterpart to `mock`, with a non-LiveKit transport and no agent worker, so the
path that costs money in production costs nothing to keep honest.

## Authentication

Access tokens are short-lived and carry the workspace, so requests scope
without a database read. Refresh tokens are long-lived and versioned against
`User.tokenVersion`; incrementing it invalidates every outstanding token at
once, which is how sign-out-everywhere works without a revocation list.

Until Phase 4 `resolveWorkspace` fell back to "whichever workspace exists" so
the call path could be built before auth did. That fallback is gone - it was a
complete tenancy bypass waiting to reach production. Dev convenience now comes
from the seed printing usable credentials.

## Rejected alternatives

**Self-hosting an open-source model** (MuseTalk, LivePortrait). No suitable GPU
is available, and rented GPU capacity plus the operational burden outweighs
per-minute vendor pricing well past early scale. Worth revisiting only at
sustained high volume.

**Committing to one vendor.** Cheaper to build and materially riskier. The
adapter costs one indirection and buys the ability to move.

**A single adapter method for both vendor shapes.** Attempted and discarded:
full-pipeline vendors have no renderer and their own transport, so the
abstraction would leak at the first Tavus call.
