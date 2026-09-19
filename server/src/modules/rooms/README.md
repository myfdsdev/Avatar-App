# rooms

Entry point for starting and ending a call.

This module owns the branch between the two vendor shapes: render-only vendors
get a LiveKit room we control plus an agent dispatch, full-pipeline vendors get
a session created on their own infrastructure. The client receives the same
envelope either way and branches only on `transport`.
