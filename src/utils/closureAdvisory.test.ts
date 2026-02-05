import assert from "node:assert/strict";
import test from "node:test";
import type { WeatherWarningSignal } from "../types";
import { resolveClosureAdvisory } from "./closureAdvisory";

function makeSignal(overrides: Partial<WeatherWarningSignal> = {}): WeatherWarningSignal {
  return {
    hasActiveWarning: false,
    hasWarningWithin2Hours: false,
    hasWarningLaterToday: false,
    activeWarningSeverity: null,
    nextWarningOnset: null,
    nextWarningSeverity: null,
    fetchedAt: "2026-02-05T12:00:00.000Z",
    ...overrides,
  };
}

test("closed codes suppress predictive advisories", () => {
  const advisory = resolveClosureAdvisory(6, makeSignal({ hasActiveWarning: true }));
  assert.equal(advisory.state, "none");
});

test("active warning becomes likely_closed_now", () => {
  const advisory = resolveClosureAdvisory(
    1,
    makeSignal({ hasActiveWarning: true, nextWarningOnset: "2026-02-05T11:00:00.000Z" })
  );

  assert.equal(advisory.state, "likely_closed_now");
});

test("upcoming warning inside 2 hours becomes closing_soon", () => {
  const advisory = resolveClosureAdvisory(
    1,
    makeSignal({ hasWarningWithin2Hours: true, nextWarningOnset: "2026-02-05T13:00:00.000Z" })
  );

  assert.equal(advisory.state, "closing_soon");
});

test("later warning today becomes closing_later_today", () => {
  const advisory = resolveClosureAdvisory(
    1,
    makeSignal({ hasWarningLaterToday: true, nextWarningOnset: "2026-02-05T19:00:00.000Z" })
  );

  assert.equal(advisory.state, "closing_later_today");
});

test("active warning has priority over upcoming signals", () => {
  const advisory = resolveClosureAdvisory(
    1,
    makeSignal({
      hasActiveWarning: true,
      hasWarningWithin2Hours: true,
      hasWarningLaterToday: true,
    })
  );

  assert.equal(advisory.state, "likely_closed_now");
});
