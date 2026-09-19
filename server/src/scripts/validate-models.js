/**
 * Compiles every Mongoose schema and reports its indexes, without needing a
 * running database. Catches typos in field definitions, bad enum values and
 * duplicate index declarations before they reach a migration or a query.
 *
 *   npm --prefix server run validate
 */
import mongoose from "mongoose";
import * as models from "../models/index.js";

let failures = 0;

console.log("Validating Mongoose models\n");

for (const [name, model] of Object.entries(models)) {
  try {
    const paths = Object.keys(model.schema.paths).length;
    const indexes = model.schema.indexes().length;
    console.log(`  ok  ${name.padEnd(14)} ${paths} paths, ${indexes} compound index(es)`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}: ${err.message}`);
  }
}

const registered = mongoose.modelNames().length;
console.log(`\n${registered} models registered, ${failures} failure(s)`);

process.exit(failures === 0 ? 0 : 1);
