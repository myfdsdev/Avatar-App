/**
 * The one error a blocked account gets, everywhere it is refused.
 *
 * `code` lets the client tell it apart from any other 403 and sign the person
 * out, rather than leaving them on pages that all fail.
 */
export function accountBlocked() {
  const err = new Error("This account has been blocked. Contact support if you think this is a mistake.");
  err.statusCode = 403;
  err.code = "account_blocked";
  return err;
}
