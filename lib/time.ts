/** Matches a race time written as text, e.g. "13:47.76" or "9:16.68"
 * (minutes:seconds(.hundredths) - the common track convention, where the
 * minutes part can run past 59 for a long race written without an hours
 * digit, e.g. "130:05" for 2h10m05s) or "2:10:05" (hours:minutes:seconds -
 * the common road/marathon convention). Non-time text in the same column
 * (e.g. "途中棄権" for a DNF) simply doesn't match either pattern. */
const MIN_SEC_PATTERN = /^(\d{1,4}):([0-5]\d)(?:\.(\d+))?$/;
const HOUR_MIN_SEC_PATTERN = /^(\d{1,2}):([0-5]\d):([0-5]\d)(?:\.(\d+))?$/;

/** Parses a race time written as either "M:SS(.ms)" or "H:MM:SS(.ms)" into
 * total seconds. Used both for the dashboard's generic 競技結果 metric
 * parsing (lib/notion.ts) and for computing WA得点 from a race result
 * (lib/wa-scoring.ts). */
export function parseRaceTimeSeconds(text: string): number | null {
  const trimmed = text.trim();

  const hms = HOUR_MIN_SEC_PATTERN.exec(trimmed);
  if (hms) {
    const hours = Number(hms[1]);
    const minutes = Number(hms[2]);
    const seconds = Number(hms[3]);
    const fraction = hms[4] ? Number(`0.${hms[4]}`) : 0;
    return Math.round((hours * 3600 + minutes * 60 + seconds + fraction) * 100) / 100;
  }

  const ms = MIN_SEC_PATTERN.exec(trimmed);
  if (ms) {
    const minutes = Number(ms[1]);
    const seconds = Number(ms[2]);
    const fraction = ms[3] ? Number(`0.${ms[3]}`) : 0;
    return Math.round((minutes * 60 + seconds + fraction) * 100) / 100;
  }

  return null;
}
