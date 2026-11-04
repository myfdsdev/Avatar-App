import { withKeys } from "../modules/byok/byok.context.js";

/**
 * Validates a request against Zod schemas and replaces the raw input with the
 * parsed result, so handlers work with coerced, trusted values.
 *
 * @param {{ body?: import("zod").ZodTypeAny, query?: import("zod").ZodTypeAny, params?: import("zod").ZodTypeAny }} schemas
 */
export function validate(schemas) {
  return (req, res, next) => {
    try {
      for (const key of ["body", "query", "params"]) {
        if (schemas[key]) req[key] = schemas[key].parse(req[key]);
      }
      next();
    } catch (err) {
      // ZodError exposes `message` as a getter, so it cannot be re-used by
      // mutation. Build a fresh error carrying the issues as structured details.
      const failure = new Error("Validation failed");
      failure.statusCode = 400;
      failure.details = err.issues?.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      next(failure);
    }
  };
}

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => {
  const run = () => Promise.resolve(fn(req, res, next)).catch(next);
  // The workspace's own vendor keys (see modules/byok/byok.context.js).
  return req.byokKeys ? withKeys(req.byokKeys, run) : run();
};
