import assert from "node:assert/strict";
import test from "node:test";
import { formatIncidentHours } from "./incidentHours";

test("converts spanish connector to hyphenated range", () => {
  assert.equal(formatIncidentHours("14:00 a 20:00"), "14:00 - 20:00");
});

test("converts english connector to hyphenated range", () => {
  assert.equal(formatIncidentHours("14:00 to 20:00"), "14:00 - 20:00");
});

test("converts bare start/end pair to hyphenated range", () => {
  assert.equal(formatIncidentHours("00:00 24:00"), "00:00 - 24:00");
});

test("normalizes dash spacing and variant", () => {
  assert.equal(formatIncidentHours("14:00–20:00"), "14:00 - 20:00");
});

test("keeps non-range text unchanged", () => {
  assert.equal(formatIncidentHours("Sin horario"), "Sin horario");
});
