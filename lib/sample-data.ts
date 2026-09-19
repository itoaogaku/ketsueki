import type { BloodTestRecord, Dorm, GameResultRecord } from "./types";

// Deterministic PRNG so the demo dataset looks the same on every request
// (each generator below creates its own instance rather than sharing one,
// so repeated calls don't drift as the shared state advances).
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGaussian(seed: number) {
  const rand = mulberry32(seed);
  return (mean: number, sd: number) => {
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * sd;
  };
}

const SURNAMES = [
  "佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村",
  "小林", "加藤", "吉田", "山田", "松本", "井上", "木村", "林",
];

const MONTHS = ["2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09"];

interface PlayerProfile {
  name: string;
  dorm: Dorm;
  baseHb: number;
  baseFe: number;
  baseCK: number;
  baseFerritin: number;
  baseTP: number;
}

function buildPlayers(gaussian: ReturnType<typeof makeGaussian>): PlayerProfile[] {
  return SURNAMES.map((name, i) => {
    const dorm: Dorm = i % 2 === 0 ? "1軍寮" : "2軍寮";
    // 1軍寮 players get a slightly richer/managed diet: modestly higher
    // Hb/Fe/フェリチン and lower CK (less residual fatigue) on average.
    const dormBoost = dorm === "1軍寮" ? 1 : 0;
    return {
      name: `${name}選手`,
      dorm,
      baseHb: gaussian(14.6 + dormBoost * 0.5, 0.6),
      baseFe: gaussian(95 + dormBoost * 15, 15),
      baseCK: gaussian(280 - dormBoost * 40, 40),
      baseFerritin: gaussian(80 + dormBoost * 20, 20),
      baseTP: gaussian(7.2 + dormBoost * 0.1, 0.3),
    };
  });
}

let cachedBloodData: BloodTestRecord[] | null = null;

export function generateSampleBloodData(): BloodTestRecord[] {
  if (cachedBloodData) return cachedBloodData;

  const gaussian = makeGaussian(20260101);
  const players = buildPlayers(gaussian);
  const records: BloodTestRecord[] = [];
  let id = 1;
  for (const p of players) {
    MONTHS.forEach((month, mIdx) => {
      // Mild within-season drift + noise per player per month.
      const fatigue = Math.sin(mIdx / 1.5) * 10;
      records.push({
        id: `sample-${id++}`,
        player: p.name,
        date: `${month}-15`,
        dorm: p.dorm,
        values: {
          "Hb(ヘモグロビン)": round(gaussian(p.baseHb - mIdx * 0.03, 0.3), 1),
          "Fe(血清鉄)": round(gaussian(p.baseFe - fatigue, 10), 0),
          "CK(クレアチンキナーゼ)": round(gaussian(p.baseCK + fatigue * 3, 30), 0),
          "フェリチン": round(gaussian(p.baseFerritin - fatigue * 0.5, 12), 0),
          "総タンパク(TP)": round(gaussian(p.baseTP, 0.2), 1),
        },
      });
    });
  }
  cachedBloodData = records;
  return records;
}

let cachedGameResults: GameResultRecord[] | null = null;

export function generateSampleGameResults(): GameResultRecord[] {
  if (cachedGameResults) return cachedGameResults;

  const gaussian = makeGaussian(20260202);
  const records: GameResultRecord[] = [];
  let day = new Date("2025-04-10T00:00:00Z");
  let id = 1;
  for (let i = 0; i < 22; i++) {
    const monthIdx = Math.min(5, Math.floor(i / 4));
    const fatigue = Math.sin(monthIdx / 1.5) * 10;
    // Team tends to score a bit more when the squad's average iron/Hb is
    // healthier (lower `fatigue` term) - a mild, discoverable signal.
    const runsFor = Math.max(0, Math.round(gaussian(4.4 - fatigue * 0.05, 2)));
    const runsAgainst = Math.max(0, Math.round(gaussian(4.0, 2)));
    const result = runsFor > runsAgainst ? "勝" : runsFor < runsAgainst ? "負" : "分";
    records.push({
      id: `sample-game-${id++}`,
      date: day.toISOString().slice(0, 10),
      opponent: `対戦チーム${((i % 6) + 1)}`,
      metrics: { 得点: runsFor, 失点: runsAgainst },
      labels: { 勝敗: result },
    });
    day = new Date(day.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  cachedGameResults = records;
  return records;
}

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
