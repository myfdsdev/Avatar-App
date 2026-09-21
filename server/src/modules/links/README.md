# links

Public share links - talking to an avatar without an account.

The owner turns a link on in the avatar's Share dialog (`/api/avatars/:id/share`,
authenticated). Anyone holding the link can then, without signing in:

| Endpoint | Does |
|---|---|
| `GET /api/links/:token` | The avatar's name and picture, and whether it can take a call |
| `POST /api/links/:token/calls` | Starts a call as a named guest; returns the connection and a `callToken` |
| `POST /api/links/:token/calls/:id/end` | Ends that call, given its `callToken` |

Guest calls land in the workspace's Conversations with the name the guest
typed. Nothing here exposes history, transcripts or costs.

Revoking a link is resetting its token; turning it off keeps the token so it
can be turned back on without re-sending invitations.
