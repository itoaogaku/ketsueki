import { academicYear } from "./stats";
import type { Grade } from "./types";

const STANDARD_YEARS_TO_ENTER_UNIVERSITY = 18;

/**
 * The Japanese school-year cohort a birthdate belongs to: children born
 * April 2 of year Y through April 1 of year Y+1 start school together, and
 * are counted as belonging to "year Y" (the school year that starts in
 * April of year Y).
 */
function schoolCohortYear(birthdate: string): number {
  const year = Number(birthdate.slice(0, 4));
  const month = Number(birthdate.slice(5, 7));
  const day = Number(birthdate.slice(8, 10));
  const bornOnOrAfterApril2 = month > 4 || (month === 4 && day >= 2);
  return bornOnOrAfterApril2 ? year : year - 1;
}

/**
 * The academic year (April-start) a player with this birthdate would enter
 * university as a freshman, assuming standard progression (no gap year, no
 * repeated grade) - true for essentially every competitive university team
 * member, and far more reliable than trusting a hand-entered 学年 value on
 * each individual blood-test row, which drifts out of date as players
 * advance a year and old rows don't get updated.
 */
export function enteringYearFromBirthdate(birthdate: string): number {
  return schoolCohortYear(birthdate) + STANDARD_YEARS_TO_ENTER_UNIVERSITY;
}

/**
 * What grade (1年-4年) a player with this entering year would have been in
 * on the given test date - null before enrollment (recruit-era/high school
 * testing) or after the standard 4-year graduation, same as a blood-test
 * row with no usable 学年 value.
 */
export function gradeAtDate(enteringYear: number, dateStr: string): Grade | null {
  const grade = academicYear(dateStr) - enteringYear + 1;
  if (grade >= 1 && grade <= 4) return `${grade}年` as Grade;
  return null;
}
