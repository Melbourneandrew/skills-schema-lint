import assert from "node:assert/strict";
assert.equal(process.env.VALID_COUNT, "1");
assert.equal(process.env.VALID_ERRORS, "0");
assert.equal(process.env.INVALID_OUTCOME, "failure");
assert.equal(process.env.INVALID_ERRORS, "2");
console.log("Action success, failure, and output contracts verified.");
