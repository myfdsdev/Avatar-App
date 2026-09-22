# admin

Platform admin, across every workspace:

- **Monitor** - an overview (users, activity, calls, a 14-day chart, calls live now), a searchable user list, and one user's plan, avatars and calls.
- **Block / unblock** - a blocked user cannot sign in, refresh, or call the API (checked per request in `middleware/workspace.js`); their refresh tokens are revoked, live calls ended, and a blocked owner's avatars stop answering share links. Admins cannot be blocked, and nobody can block themselves.
- **Plans** - create, edit, archive, delete (only when unused), mark one as the default for new sign-ups, and assign one to a user. Limits (`includedMinutes`, `overageEnabled`, `concurrencyLimit`, `maxAvatars`; 0 = no limit) are read live by `billing/usage.service.js#limitsFor`, so editing a plan changes it for everyone on it. The price is shown, not charged. **Add ready-made plans** (`plan.templates.js`) adds Free / Starter / Pro / Business, priced above the running cost of a call; it skips keys that exist and never sets a default.

Blocks and plan assignments are written to the target workspace's audit log.

Admins are the emails in `ADMIN_EMAILS` (server `.env`), checked on every request by `middleware/admin.js`. Nothing in the API can grant it.
