# auth

Registration, sign-in, refresh and revocation.

Access tokens are short-lived and carry the workspace, so requests scope without
a database read. Refresh tokens are versioned against `User.tokenVersion` -
incrementing it invalidates every outstanding token at once, which is how
sign-out-everywhere works without a revocation list.
