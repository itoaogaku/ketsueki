import { WaCalculator } from "@glaivepro/wa-calculator";
import { parseRaceTimeSeconds } from "./time";

/**
 * Converts a race result into WA (World Athletics) Scoring Tables points, so
 * results from different events (5000m, 10000m, half marathon, marathon...)
 * become directly comparable on one scale. Uses the current (2025 edition)
 * official tables via the `@glaivepro/wa-calculator` package - its numbers
 * were cross-checked against the official "World Athletics Scoring Tables of
 * Athletics" PDF (men's long distance / road running sections) and matched
 * exactly (e.g. men's 5000m 12:10.09 -> 1400pts, 14:00.02 -> 1000pts;
 * men's 10000m 29:00.51 -> 1041pts; men's half marathon 54:55 -> 1400pts;
 * men's marathon 1:55:54 -> 1400pts), so it's trusted here rather than
 * re-deriving coefficients by hand.
 *
 * Only the team's standard distance events are covered - 駅伝 (relay) legs
 * run over non-standard, course-specific distances have no WA table entry
 * and are intentionally left unscored (resolveWaDiscipline returns null),
 * per team decision, rather than approximated.
 */

// Normalized (see normalizeEventLabel) 競技種目 value -> WA calculator
// discipline key. Covers the team's actual standard events; anything else
// (in particular 駅伝の区間名) has no entry and is left unscored.
const EVENT_ALIASES: Record<string, string> = {
  "3000m": "3000m",
  "5000m": "5000m",
  "10000m": "10000m",
  "10,000m": "10000m",
  "ハーフ": "half_marathon",
  "ハーフマラソン": "half_marathon",
  "half": "half_marathon",
  "halfmarathon": "half_marathon",
  "フル": "marathon",
  "フルマラソン": "marathon",
  "マラソン": "marathon",
  "marathon": "marathon",
};

/** Lowercases ascii letters and collapses/strips whitespace so "5000m",
 * "5000M", "5000 m" etc. all resolve the same way. */
function normalizeEventLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "");
}

const calculator = new WaCalculator({ edition: "2025", gender: "m" });

/** The WA calculator's own discipline key for a 競技種目 label, or null if
 * it's not one of the team's standard, table-covered events (e.g. a 駅伝
 * relay leg run over a non-standard distance). */
export function resolveWaDiscipline(eventLabel: string): string | null {
  const normalized = normalizeEventLabel(eventLabel);
  const known = new Set(calculator.getDisciplines());
  // The label may already literally be a WA discipline key (e.g. "5000m").
  if (known.has(eventLabel)) return eventLabel;
  return EVENT_ALIASES[normalized] ?? null;
}

export interface WaScoreComputation {
  discipline: string;
  seconds: number;
  points: number;
}

/**
 * Computes WA points for one race result, or null if the event isn't a
 * standard table-covered distance or the result text isn't a parseable
 * race time (e.g. "途中棄権" for a DNF, or a 駅伝区間 result recorded some
 * other way).
 */
export function computeWaPoints(
  eventLabel: string,
  resultText: string,
  gender: "m" | "f" = "m"
): WaScoreComputation | null {
  const discipline = resolveWaDiscipline(eventLabel);
  if (!discipline) return null;

  const seconds = parseRaceTimeSeconds(resultText);
  if (seconds === null) return null;

  calculator.setOptions({ discipline, gender });
  const points = calculator.evaluate(seconds);
  if (points === null) return null;

  return { discipline, seconds, points };
}
