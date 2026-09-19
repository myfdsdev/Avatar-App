# Cost model

Planning figures for a render-only call, where every component is ours except
the avatar. All per-minute, USD, list pricing.

## Per-minute build-up

| Component | Choice | $/min | Notes |
|---|---|---|---|
| Transport | LiveKit Cloud | ~0.005 | participant minutes, two participants |
| Speech-to-text | Deepgram Nova-3 | ~0.008 | streaming |
| Language model | Claude Sonnet | ~0.010 | varies with prompt size and turn density |
| Text-to-speech | Cartesia Sonic-3 | ~0.020 | billed on characters, not wall clock |
| **Avatar video** | **LemonSlice** | **0.164** | dominant line item |
| | | **~0.207** | **render-only total** |

Full-pipeline (Tavus) is a single line at ~$0.37/min with no separable parts -
the trade is less control for less integration work.

## What this means

The avatar is roughly 80% of the cost. Optimising the language model or
transport barely moves the number; changing avatar vendor or tier moves it a
lot. Any margin work starts there.

For reference, Simli's Trinity-1 is marketed under $0.01/min, which would cut a
render-only call from ~$0.21 to ~$0.05. It is Python-only today, which is the
concrete price of the single-runtime decision - see `PROVIDERS.md`.

## Pricing implications

At ~$0.21/min cost:

| Retail $/min | Gross margin |
|---|---|
| 0.30 | 30% |
| 0.50 | 58% |
| 0.75 | 72% |

Per-minute retail below ~$0.25 has no room in it at list prices. Subscription
tiers with included minutes plus overage work better than pure usage billing,
because included minutes are rarely fully consumed.

## Non-call costs

- **Video clone training** is charged per replica, not per minute (Tavus: ~$65
  for extra replicas, falling with volume). Bill it as a one-off, not usage.
- **Storage** is negligible per user but grows with retained training videos.
  Add a retention policy before it matters.
- **Idle concurrency** is free here - no reserved GPU capacity is held.

## Reconciliation

`approxCostPerMinUsd` in the capability matrix is for routing and forecasting
only. Actual spend is written to `UsageLedger` when a conversation ends, from
real duration. Never bill from the estimate.
