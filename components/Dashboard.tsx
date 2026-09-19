"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatTile } from "./StatTile";
import { TrendLineChart } from "./TrendLineChart";
import { CorrelationScatter } from "./CorrelationScatter";
import { DataTable } from "./DataTable";
import { GradeTable } from "./GradeTable";
import {
  computeAllCorrelations,
  computeCorrelation,
  computeDormComparison,
  computeTrend,
} from "@/lib/stats";
import type { BloodDataResponse, Dorm, GameResultsResponse } from "@/lib/types";

const WINDOW_OPTIONS = [3, 7, 14, 30];

function interpretR(r: number | null): string {
  if (r === null) return "データ不足のため判定できません";
  const abs = Math.abs(r);
  const strength =
    abs >= 0.7 ? "強い" : abs >= 0.4 ? "中程度の" : abs >= 0.2 ? "弱い" : "ほとんどない";
  const direction = r >= 0 ? "正の" : "負の";
  return abs < 0.2 ? "相関はほとんどありません" : `${direction}${strength}相関があります`;
}

export function Dashboard({
  bloodData,
  gameData,
}: {
  bloodData: BloodDataResponse;
  gameData: GameResultsResponse;
}) {
  const [dorm, setDorm] = useState<Dorm | "all">("all");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [parameter, setParameter] = useState(bloodData.parameters[0] ?? "");
  const [showTable, setShowTable] = useState(false);

  const [corrParameter, setCorrParameter] = useState(bloodData.parameters[0] ?? "");
  const [corrMetric, setCorrMetric] = useState(gameData.metrics[0] ?? "");
  const [windowDays, setWindowDays] = useState(7);

  const togglePlayer = (name: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const trend = useMemo(
    () => computeTrend(bloodData.records, { parameter, dorm, players: selectedPlayers }),
    [bloodData.records, parameter, dorm, selectedPlayers]
  );

  const dormComparison = useMemo(
    () => computeDormComparison(bloodData.records, parameter, selectedPlayers),
    [bloodData.records, parameter, selectedPlayers]
  );

  const filteredPlayerCount = useMemo(() => {
    const set = new Set<string>();
    for (const r of bloodData.records) {
      if (dorm !== "all" && r.dorm !== dorm) continue;
      if (selectedPlayers.length > 0 && !selectedPlayers.includes(r.player)) continue;
      if (typeof r.values[parameter] === "number") set.add(r.player);
    }
    return set.size;
  }, [bloodData.records, dorm, selectedPlayers, parameter]);

  const totalCount = trend.reduce((s, t) => s + t.count, 0);
  const latest = trend[trend.length - 1];
  const previous = trend[trend.length - 2];
  const delta =
    latest && previous ? Math.round((latest.average - previous.average) * 100) / 100 : null;

  const correlation = useMemo(
    () =>
      computeCorrelation(bloodData.records, gameData.records, {
        parameter: corrParameter,
        metric: corrMetric,
        dorm,
        windowDays,
      }),
    [bloodData.records, gameData.records, corrParameter, corrMetric, dorm, windowDays]
  );

  const ranked = useMemo(
    () =>
      computeAllCorrelations(
        bloodData.records,
        gameData.records,
        bloodData.parameters,
        gameData.metrics,
        { dorm, windowDays }
      ).slice(0, 10),
    [bloodData.records, gameData.records, bloodData.parameters, gameData.metrics, dorm, windowDays]
  );

  const players = bloodData.players.filter((p) =>
    dorm === "all" ? true : bloodData.records.some((r) => r.player === p && r.dorm === dorm)
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              血液検査データ分析ダッシュボード
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              選手の血液検査データの推移と、1寮生・2寮生の違い、試合結果との相関を確認できます。
            </p>
          </div>
          <Link
            href="/import"
            className="rounded px-3 py-2 text-sm font-medium"
            style={{ background: "var(--series-1)", color: "#ffffff" }}
          >
            CSVインポート
          </Link>
        </div>
        <SourceBadge blood={bloodData.source} games={gameData.source} />
      </header>

      {/* Grade view: reproduces the original spreadsheet's per-grade wide table */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          学年別一覧
        </h2>
        <GradeTable bloodData={bloodData} />
      </section>

      {/* Filters */}
      <section
        className="flex flex-wrap items-end gap-4 rounded-lg p-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
      >
        <Field label="寮">
          <select
            className="select"
            value={dorm}
            onChange={(e) => setDorm(e.target.value as Dorm | "all")}
          >
            <option value="all">1寮生・2寮生 両方</option>
            <option value="1寮生">1寮生のみ</option>
            <option value="2寮生">2寮生のみ</option>
          </select>
        </Field>

        <Field label="検査項目">
          <select className="select" value={parameter} onChange={(e) => setParameter(e.target.value)}>
            {bloodData.parameters.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field label="選手（未選択=全員）" wide>
          <div
            className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-md p-2"
            style={{ border: "1px solid var(--border)", maxWidth: 420 }}
          >
            {players.map((p) => {
              const active = selectedPlayers.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlayer(p)}
                  className="rounded px-2 py-1 text-xs"
                  style={{
                    background: active ? "var(--series-1)" : "transparent",
                    color: active ? "#ffffff" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {p}
                </button>
              );
            })}
            {selectedPlayers.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedPlayers([])}
                className="rounded px-2 py-1 text-xs underline"
                style={{ color: "var(--text-muted)" }}
              >
                選択解除
              </button>
            )}
          </div>
        </Field>
      </section>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="直近月の平均値"
          value={latest ? String(latest.average) : "—"}
          hint={latest?.period}
        />
        <StatTile
          label="前月比"
          value={delta === null ? "—" : (delta > 0 ? "+" : "") + delta}
        />
        <StatTile label="対象選手数" value={String(filteredPlayerCount)} unit="人" />
        <StatTile label="検査件数" value={String(totalCount)} unit="件" />
      </section>

      {/* Trend chart */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            {parameter} の推移{dorm === "all" ? "（1寮生 vs 2寮生）" : `（${dorm}）`}
          </h2>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="text-xs underline"
            style={{ color: "var(--text-muted)" }}
          >
            {showTable ? "グラフを表示" : "表で表示"}
          </button>
        </div>

        {dorm === "all" ? (
          showTable ? (
            <DataTable
              columns={[
                { key: "period", label: "月" },
                { key: "1寮生", label: "1寮生 平均", align: "right" },
                { key: "2寮生", label: "2寮生 平均", align: "right" },
              ]}
              rows={dormComparison.map((d) => ({
                period: d.period,
                "1寮生": d["1寮生"] ?? "-",
                "2寮生": d["2寮生"] ?? "-",
              }))}
            />
          ) : (
            <TrendLineChart
              data={dormComparison}
              series={[
                { key: "1寮生", label: "1寮生", color: "var(--series-1)" },
                { key: "2寮生", label: "2寮生", color: "var(--series-2)" },
              ]}
            />
          )
        ) : showTable ? (
          <DataTable
            columns={[
              { key: "period", label: "月" },
              { key: "average", label: "平均値", align: "right" },
              { key: "count", label: "件数", align: "right" },
            ]}
            rows={trend}
          />
        ) : (
          <TrendLineChart
            data={trend}
            series={[{ key: "average", label: parameter, color: "var(--series-1)" }]}
          />
        )}
      </section>

      {/* Correlation with game results */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          試合結果との相関分析
        </h2>

        <div className="flex flex-wrap items-end gap-4">
          <Field label="血液検査項目">
            <select
              className="select"
              value={corrParameter}
              onChange={(e) => setCorrParameter(e.target.value)}
            >
              {bloodData.parameters.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="試合指標">
            <select className="select" value={corrMetric} onChange={(e) => setCorrMetric(e.target.value)}>
              {gameData.metrics.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="試合前の集計期間">
            <select
              className="select"
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
            >
              {WINDOW_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  試合前{d}日間
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div
          className="grid gap-4 rounded-lg p-4 sm:grid-cols-[280px_1fr]"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
        >
          <div className="space-y-2">
            <StatTile
              label="相関係数 (r)"
              value={correlation.r === null ? "—" : String(correlation.r)}
              hint={`n=${correlation.n}`}
            />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {interpretR(correlation.r)}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              各試合の前{windowDays}日間に測定された「{corrParameter}」の平均値と、その試合の「
              {corrMetric}」の関係を見ています。相関はあくまで統計的な傾向であり、因果関係を示すものではありません。
            </p>
          </div>
          <CorrelationScatter points={correlation.points} xLabel={corrParameter} yLabel={corrMetric} />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            相関が強い組み合わせ（上位10件）
          </h3>
          <DataTable
            columns={[
              { key: "parameter", label: "血液検査項目" },
              { key: "metric", label: "試合指標" },
              { key: "r", label: "相関係数", align: "right" },
              { key: "n", label: "件数", align: "right" },
            ]}
            rows={ranked.map((r) => ({
              parameter: r.parameter,
              metric: r.metric,
              r: r.r ?? "-",
              n: r.n,
            }))}
          />
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs ${wide ? "flex-1" : ""}`}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

function SourceBadge({
  blood,
  games,
}: {
  blood: "notion" | "sample";
  games: "notion" | "sample";
}) {
  const isSample = blood === "sample" || games === "sample";
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
