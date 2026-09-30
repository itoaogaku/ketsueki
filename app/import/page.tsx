"use client";

import Link from "next/link";
import { useState } from "react";
import { BloodCsvImporter } from "@/components/BloodCsvImporter";
import type { PrepareWaSyncResult, PreparedWaRow } from "@/lib/sync-wa-scores";

// Kept deliberately small: each Notion write in a batch takes an unknown,
// possibly-slow amount of real network time (a couple of failed attempts at
// 100/batch still ran into the serverless function's time limit even with
// no re-reading of the source database - see lib/sync-wa-scores.ts), so this
// errs on the side of finishing many small, reliable requests over risking
// another timeout with a larger one.
const WA_BATCH_SIZE = 25;

/** Retries a POST a few times (short backoff) on a network-level failure
 * (fetch() itself throwing - a dropped connection, laptop sleep, etc.), not
 * on a clean non-2xx response (e.g. a wrong passcode), which the caller
 * already handles and retrying wouldn't fix. A WA score sync's write phase
 * can run for many minutes across ~180 small batches, and a single dropped
 * request used to abort the whole thing - this lets it ride out a
 * transient blip instead of losing everything written so far. */
async function postJsonWithRetry(body: unknown, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch("/api/sync-wa-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

interface WaSyncDisplaySummary {
  totalSourceRows: number;
  parsedRows: number;
  outOfScope: number;
  unparseable: number;
  warnings: string[];
  created: number;
  updated: number;
  targetTotal: number;
  dryRun: boolean;
}

export default function ImportPage() {
  const [secret, setSecret] = useState("");

  const [waLoading, setWaLoading] = useState(false);
  const [waPhase, setWaPhase] = useState<string | null>(null);
  const [waSummary, setWaSummary] = useState<WaSyncDisplaySummary | null>(null);
  const [waError, setWaError] = useState<string | null>(null);

  const syncWa = async (waDryRun: boolean) => {
    setWaLoading(true);
    setWaError(null);
    setWaSummary(null);
    setWaPhase("準備中（競技結果データベースを読み込んでいます）...");
    let totalCreated = 0;
    let totalUpdated = 0;
    let phase: "prepare" | "write" = "prepare";
    try {
      const prepareRes = await postJsonWithRetry({ secret: secret || undefined, mode: "prepare" });
      const prepareData = await prepareRes.json();
      if (!prepareRes.ok) {
        setWaError(`準備段階で失敗: ${prepareData.error ?? "不明なエラー"}`);
        return;
      }
      const prepared: PrepareWaSyncResult = prepareData.result;

      const base: Omit<WaSyncDisplaySummary, "created" | "updated"> = {
        totalSourceRows: prepared.totalSourceRows,
        parsedRows: prepared.parsedRows,
        outOfScope: prepared.outOfScope,
        unparseable: prepared.unparseable,
        warnings: prepared.warnings,
        targetTotal: prepared.rows.length,
        dryRun: waDryRun,
      };

      if (waDryRun) {
        // Whether each row is a create or an update is no longer resolved
        // here (see lib/sync-wa-scores.ts's prepareWaScoreSync doc comment -
        // reading the whole, ever-growing WAスコア database up front to
        // answer that got too slow), so a dry run can only preview the
        // target count, not split it - the real created/updated counts show
        // up progressively once an actual sync starts writing.
        setWaSummary({ ...base, created: 0, updated: 0 });
        return;
      }

      setWaSummary({ ...base, created: 0, updated: 0 });
      phase = "write";

      for (let i = 0; i < prepared.rows.length; i += WA_BATCH_SIZE) {
        const batch: PreparedWaRow[] = prepared.rows.slice(i, i + WA_BATCH_SIZE);
        setWaPhase(`書き込み中... (${totalCreated + totalUpdated}/${prepared.rows.length}件)`);
        const writeRes = await postJsonWithRetry({
          secret: secret || undefined,
          mode: "write",
          rows: batch,
        });
        const writeData = await writeRes.json();
        if (!writeRes.ok) {
          setWaError(
            `書き込み中に失敗（${totalCreated + totalUpdated}/${prepared.rows.length}件まで完了）: ${writeData.error ?? "不明なエラー"}`
          );
          return;
        }
        const round: { created: number; updated: number } = writeData.result;
        totalCreated += round.created;
        totalUpdated += round.updated;
        setWaSummary({ ...base, created: totalCreated, updated: totalUpdated });
      }
    } catch {
      const phaseLabel = phase === "prepare" ? "準備段階" : "書き込み段階";
      setWaError(
        `通信エラーが発生しました（${phaseLabel}で発生。${totalCreated + totalUpdated}件まで書き込み完了している可能性があります）`
      );
    } finally {
      setWaLoading(false);
      setWaPhase(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <Link href="/" className="text-sm" style={{ color: "var(--brand)" }}>
          ← ダッシュボードに戻る
        </Link>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          血液検査データCSVインポート
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          CSVファイルをアップロードすると、Notionの血液検査データベース（実業団を含む）に取り込みます。
          「選手名」「検査日」は必須列、「寮」「学年」は任意、それ以外の列は検査項目として自動認識されます。
        </p>
      </header>

      <BloodCsvImporter endpoint="/api/import-blood-data" secret={secret} onSecretChange={setSecret} />

      <section
        className="space-y-4 rounded-lg p-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
      >
        <div>
          <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            WAスコアの同期
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            競技結果データベースの標準種目（5000m・10000m・ハーフマラソン・マラソンなど）を、World
            Athletics公式スコアリングテーブルの得点に変換し、WAスコアデータベースへ反映します（上のパスコード欄を使用）。駅伝の区間など非標準距離の結果は対象外です。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => syncWa(true)}
            disabled={waLoading}
            className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
          >
            {waLoading ? waPhase ?? "処理中..." : "内容を確認（書き込まない）"}
          </button>
          <button
            type="button"
            onClick={() => syncWa(false)}
            disabled={waLoading}
            className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--brand)", color: "#ffffff" }}
          >
            {waLoading ? waPhase ?? "処理中..." : "Notionに反映"}
          </button>
        </div>

        {waError && (
          <div
            className="rounded-lg p-3 text-sm"
            style={{ background: "rgba(208, 59, 59, 0.1)", color: "var(--status-critical)" }}
          >
            {waError}
          </div>
        )}

        {waSummary && (
          <div className="space-y-1 text-sm" style={{ color: "var(--text-primary)" }}>
            <p>
              {waSummary.totalSourceRows}件中 {waSummary.parsedRows}件から選手名・日付・種目・結果を取得しました
            </p>
            <ul className="space-y-0.5">
              {waSummary.dryRun ? (
                <li>変換対象: {waSummary.targetTotal}件（作成/更新の内訳は実行時に判明します）</li>
              ) : (
                <>
                  <li>進捗: {waSummary.created + waSummary.updated} / {waSummary.targetTotal}件</li>
                  <li>作成: {waSummary.created}件</li>
                  <li>更新: {waSummary.updated}件</li>
                </>
              )}
              <li style={{ color: "var(--text-secondary)" }}>
                対象外（非標準種目）: {waSummary.outOfScope}件 / 記録形式不明: {waSummary.unparseable}件
              </li>
            </ul>
            {waSummary.warnings.length > 0 && (
              <details>
                <summary style={{ color: "var(--text-muted)", cursor: "pointer" }}>
                  詳細 ({waSummary.warnings.length}件)
                </summary>
                <ul className="mt-1 space-y-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {waSummary.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
