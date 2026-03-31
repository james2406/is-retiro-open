import assert from "node:assert/strict";
import test from "node:test";
import { resolveParkHours } from "./parkHours";

// Helper: create a Date in UTC that maps to a known Madrid local time.
// CET (winter) = UTC+1, CEST (summer) = UTC+2.

test("winter morning, park is open", () => {
  // Jan 15, 10:00 Madrid = 09:00 UTC (CET)
  const result = resolveParkHours(new Date("2026-01-15T09:00:00Z"));
  assert.equal(result.state, "open");
  assert.equal(result.closeTime, "22:00");
});

test("winter evening, closing soon", () => {
  // Jan 15, 21:15 Madrid = 20:15 UTC
  const result = resolveParkHours(new Date("2026-01-15T20:15:00Z"));
  assert.equal(result.state, "closing_soon");
});

test("winter night, closed", () => {
  // Jan 15, 22:30 Madrid = 21:30 UTC
  const result = resolveParkHours(new Date("2026-01-15T21:30:00Z"));
  assert.equal(result.state, "closed_for_night");
});

test("winter pre-dawn, closed", () => {
  // Jan 15, 03:00 Madrid = 02:00 UTC
  const result = resolveParkHours(new Date("2026-01-15T02:00:00Z"));
  assert.equal(result.state, "closed_for_night");
});

test("summer midday, open", () => {
  // Jul 15, 14:00 Madrid = 12:00 UTC (CEST)
  const result = resolveParkHours(new Date("2026-07-15T12:00:00Z"));
  assert.equal(result.state, "open");
  assert.equal(result.closeTime, "00:00");
});

test("summer evening, closing soon", () => {
  // Jul 15, 23:20 Madrid = 21:20 UTC
  const result = resolveParkHours(new Date("2026-07-15T21:20:00Z"));
  assert.equal(result.state, "closing_soon");
});

test("summer exactly at midnight (00:00), closed", () => {
  // Jul 16, 00:00 Madrid = 22:00 UTC (Jul 15)
  const result = resolveParkHours(new Date("2026-07-15T22:00:00Z"));
  assert.equal(result.state, "closed_for_night");
});

test("summer 00:30, closed", () => {
  // Jul 16, 00:30 Madrid = 22:30 UTC (Jul 15)
  const result = resolveParkHours(new Date("2026-07-15T22:30:00Z"));
  assert.equal(result.state, "closed_for_night");
});

test("summer post-midnight, closed", () => {
  // Jul 16, 01:00 Madrid = 23:00 UTC (Jul 15)
  const result = resolveParkHours(new Date("2026-07-15T23:00:00Z"));
  assert.equal(result.state, "closed_for_night");
});

test("summer pre-dawn, closed", () => {
  // Jul 16, 05:00 Madrid = 03:00 UTC
  const result = resolveParkHours(new Date("2026-07-16T03:00:00Z"));
  assert.equal(result.state, "closed_for_night");
});

test("exactly at opening time (6:00), open", () => {
  // Jan 15, 06:00 Madrid = 05:00 UTC
  const result = resolveParkHours(new Date("2026-01-15T05:00:00Z"));
  assert.equal(result.state, "open");
});

test("exactly at winter closing time (22:00), closed", () => {
  // Jan 15, 22:00 Madrid = 21:00 UTC
  const result = resolveParkHours(new Date("2026-01-15T21:00:00Z"));
  assert.equal(result.state, "closed_for_night");
});

test("one minute before winter close (21:59), closing soon", () => {
  // Jan 15, 21:59 Madrid = 20:59 UTC
  const result = resolveParkHours(new Date("2026-01-15T20:59:00Z"));
  assert.equal(result.state, "closing_soon");
});

test("winter, just before closing-soon window (20:59), open", () => {
  // Jan 15, 20:59 Madrid = 19:59 UTC → 61 minutes until 22:00
  const result = resolveParkHours(new Date("2026-01-15T19:59:00Z"));
  assert.equal(result.state, "open");
});

test("winter, start of closing-soon window (21:00), closing soon", () => {
  // Jan 15, 21:00 Madrid = 20:00 UTC → exactly 60 minutes until 22:00
  const result = resolveParkHours(new Date("2026-01-15T20:00:00Z"));
  assert.equal(result.state, "closing_soon");
});

test("season boundary: March 31 uses winter schedule", () => {
  // Mar 31 2026 is CEST (clocks changed last Sunday of March = Mar 29)
  // Mar 31, 21:30 Madrid = 19:30 UTC (CEST = UTC+2)
  const result = resolveParkHours(new Date("2026-03-31T19:30:00Z"));
  assert.equal(result.state, "closing_soon");
  assert.equal(result.closeTime, "22:00");
});

test("season boundary: April 1 uses summer schedule", () => {
  // Apr 1, 21:30 Madrid = 19:30 UTC (CEST)
  const result = resolveParkHours(new Date("2026-04-01T19:30:00Z"));
  assert.equal(result.state, "open");
  assert.equal(result.closeTime, "00:00");
});

test("summer 22:00 is still open (closes at midnight)", () => {
  // Jul 15, 22:00 Madrid = 20:00 UTC
  const result = resolveParkHours(new Date("2026-07-15T20:00:00Z"));
  assert.equal(result.state, "open");
});

test("summer 22:59 is still open", () => {
  // Jul 15, 22:59 Madrid = 20:59 UTC
  const result = resolveParkHours(new Date("2026-07-15T20:59:00Z"));
  assert.equal(result.state, "open");
});

test("openTime is always 06:00", () => {
  const winter = resolveParkHours(new Date("2026-01-15T09:00:00Z"));
  const summer = resolveParkHours(new Date("2026-07-15T12:00:00Z"));
  assert.equal(winter.openTime, "06:00");
  assert.equal(summer.openTime, "06:00");
});
