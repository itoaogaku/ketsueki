"use client";

import Link from "next/link";
import { GradeTable } from "./GradeTable";
import { GroupComparisonSection } from "./GroupComparisonSection";
import { PlayerHistoryTable } from "./PlayerHistoryTable";
import { PlayerTrendChart } from "./PlayerTrendChart";
import { DateLookupTable } from "./DateLookupTable";
import { DORM_COMPARISON_GROUPS, GRADE_COMPARISON_GROUPS } from "@/lib/stats";
import { GRADE_OPTIONS } from "@/lib/types";
import type { BloodDataResponse, WaScoreResponse } from "@/lib/types";

// 女子チームには実業団・寮の区分がない。
const WOMEN_GRADE_OPTIONS = GRADE_OPTIONS.filter((g) => g !== "実業団");
const WOMEN_GRADE_COMPARISON_GROUPS = GRADE_COMPARISON_GROUPS.filter((g) => g.key !== "実業団");

// 検査日の「基準日」判定は男子の人数（1回40人以上）を前提にしているため、
// 人数の少ない女子チームでは2人以上受けた日を基準日として扱う。そうしないと
// 全日程が基準日から外れ、日付ごとの比較グラフから落ちてしまう。
const WOMEN_ANCHOR_MIN_PLAYERS = 2;

export function Dashboard({
  bloodData,
  gameSource,
  waData,
  title = "血液検査データ分析ダッシュボード",
  description = "選手の血液検査データの推移と、1寮生・2寮生の違いを確認できます。",
  importHref = "/import",
  gender = "m",
}: {
  bloodData: BloodDataResponse;
  // 試合結果データそのもの（gameData）は表示に使う部分（source）だけをここで
  // 渡す - Server Componentからこのクライアントコンポーネントへのpropは
  // まるごとRSCペイロードとしてブラウザに送られるため、gameData全体を渡すと
  // 実際は画面に出さない全選手・男女混在の競技結果まで誰でもdevtoolsで見えて
  // しまう（/joshiで男女を分けた意味がなくなる）。
  gameSource: "notion" | "sample";
  waData: WaScoreResponse;
  title?: string;
  description?: string;
  /** CSVインポートページへのリンク先（男子: /import、女子: /joshi/import）。 */
  importHref?: string;
  /** 基準値の色分け（赤=高値・青=低値）にどちらの基準値表を使うか。
   * "f" で /joshi用の女性基準値（REFERENCE_RANGES_FEMALE）に切り替わる。 */
  gender?: "m" | "f";
}) {
  const isWomen = gender === "f";
  const gradeOptions = isWomen ? WOMEN_GRADE_OPTIONS : GRADE_OPTIONS;
  const gradeGroups = isWomen ? WOMEN_GRADE_COMPARISON_GROUPS : GRADE_COMPARISON_GROUPS;
  const anchorMinPlayers = isWomen ? WOMEN_ANCHOR_MIN_PLAYERS : undefined;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-8 px-4 py-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {title}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {description}
            </p>
          </div>
          {importHref && (
            <Link
              href={importHref}
              className="rounded px-3 py-2 text-sm font-medium"
              style={{ background: "var(--brand)", color: "#ffffff" }}
            >
              CSVインポート
            </Link>
          )}
        </div>
        <SourceBadge blood={bloodData.source} games={gameSource} wa={waData.source} />
        {bloodData.unmatchedGradePlayers && bloodData.unmatchedGradePlayers.length > 0 && (
          <UnmatchedGradeWarning players={bloodData.unmatchedGradePlayers} />
        )}
      </header>

      {/* Grade view: reproduces the original spreadsheet's per-grade wide table */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          学年別一覧
        </h2>
        <GradeTable bloodData={bloodData} gender={gender} gradeOptions={gradeOptions} />
      </section>

      <PlayerHistoryTable bloodData={bloodData} gender={gender} />

      <DateLookupTable bloodData={bloodData} gender={gender} anchorMinPlayers={anchorMinPlayers} />

      <PlayerTrendChart
        bloodData={bloodData}
        waData={waData}
        gender={gender}
        gradeOptions={gradeOptions}
      />

      {/* 1寮生 vs 2寮生, by exact test date */}
      {!isWomen && (
        <GroupComparisonSection
          title="1寮生・2寮生の比較（検査日ごと）"
          records={bloodData.records}
          parameters={bloodData.parameters}
          groups={DORM_COMPARISON_GROUPS}
        />
      )}

      {/* Grade comparison, by exact test date */}
      <GroupComparisonSection
        title="学年別の比較（検査日ごと）"
        records={bloodData.records}
        parameters={bloodData.parameters}
        groups={gradeGroups}
        anchorMinPlayers={anchorMinPlayers}
      />
    </div>
  );
}

function SourceBadge({
  blood,
  games,
  wa,
}: {
  blood: "notion" | "sample";
  games: "notion" | "sample";
  wa: "notion" | "sample";
}) {
  const isSample = blood === "sample" || games === "sample" || wa === "sample";
  return (
    <span
      className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs"
      style={{
        background: isSample ? "rgba(250, 178, 25, 0.15)" : "rgba(12, 163, 12, 0.12)",
        color: isSample ? "#9a6b00" : "var(--status-good)",
      }}
    >
      {isSample
        ? "サンプルデータ表示中（Notion未接続）"
        : "Notionのデータに接続中"}
    </span>
  );
}

/** Points at recently-tested players whose name in the血液検査DB doesn't
 * match anyone in the 部員データベース - their 学年 is silently falling
 * back to the (possibly stale) value hand-entered on their own blood-test
 * rows instead of being computed from a birthdate, which reads exactly
 * like the auto-calculation "not working" unless it's called out. */
function UnmatchedGradeWarning({ players }: { players: string[] }) {
  return (
    <div
      className="w-fit max-w-full rounded-lg px-3 py-2 text-xs"
      style={{ background: "rgba(250, 178, 25, 0.15)", color: "#9a6b00" }}
    >
      <p className="font-medium">
        部員データベースと名前が一致しない選手がいます（学年は血液検査データベース側の値を使用中）
      </p>
      <p className="mt-0.5">{players.join("、")}</p>
      <p className="mt-0.5" style={{ color: "var(--text-muted)" }}>
        部員データベースの「氏名」がこれらの選手名と完全に一致しているか（表記ゆれ・スペースの違いなど）ご確認ください。
      </p>
    </div>
  );
}
