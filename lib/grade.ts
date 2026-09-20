import { academicYear } from "./stats";
import type { Grade } from "./types";

// 4/1〜翌年3/31生まれが同学年（年度区切り）として扱う。
//
// 標準的な進学（6歳で小学校入学、留年・浪人なしで大学まで進む）では、
// 生まれた年度の19年後の4月に大学へ入学する（小学校6年+中学3年+高校3
// 年=12年後に小学校入学年度、さらにそこから6歳になる年度である+6を
// 加えると19）。例えば2004年度生まれ（2004/4/1〜2005/3/31）は2023年
// 4月に大学入学。
const YEARS_FROM_BIRTH_FISCAL_YEAR_TO_UNIVERSITY_ENTRY = 19;

/**
 * The academic year (April-start) a player with this birthdate would enter
 * university as a freshman, assuming standard progression (no gap year, no
 * repeated grade) - true for essentially every competitive university team
 * member, and far more reliable than trusting a hand-entered 学年 value on
 * each individual blood-test row, which drifts out of date as players
 * advance a year and old rows don't get updated.
 */
export function enteringYearFromBirthdate(birthdate: string): number {
  return academicYear(birthdate) + YEARS_FROM_BIRTH_FISCAL_YEAR_TO_UNIVERSITY_ENTRY;
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
