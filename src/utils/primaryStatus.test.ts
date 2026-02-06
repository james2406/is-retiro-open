import assert from "node:assert/strict";
import test from "node:test";
import { resolvePrimaryStatus } from "./primaryStatus";

test("official closed always wins", () => {
  const result = resolvePrimaryStatus(6, "likely_closed_now");
  assert.equal(result.mode, "official");
  assert.equal(result.themeCode, 6);
});

test("active warning upgrades to predicted_closed", () => {
  const result = resolvePrimaryStatus(1, "likely_closed_now");
  assert.equal(result.mode, "predicted_closed");
  assert.equal(result.themeCode, 6);
});

test("soon warning upgrades to closing", () => {
  const result = resolvePrimaryStatus(1, "closing_soon");
  assert.equal(result.mode, "closing");
  assert.equal(result.themeCode, 4);
});

test("later today keeps official status", () => {
  const result = resolvePrimaryStatus(1, "closing_later_today");
  assert.equal(result.mode, "official");
  assert.equal(result.themeCode, 1);
});

test("null code defaults to official open", () => {
  const result = resolvePrimaryStatus(null, "likely_closed_now");
  assert.equal(result.mode, "official");
  assert.equal(result.themeCode, 1);
});

test("no advisory keeps official status", () => {
  const result = resolvePrimaryStatus(2, "none");
  assert.equal(result.mode, "official");
  assert.equal(result.themeCode, 2);
});
