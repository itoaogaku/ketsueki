"use client";

import Link from "next/link";
import { useState } from "react";
import type { ImportSummary } from "@/lib/import-blood-csv";
import type { SyncWaScoresSummary } from "@/lib/sync-wa-scores";

// A large CSV writes one Notion page at a time (to respect the API's rate
// limit), which can take longer than a single serverless invocation allows.
// So writes happen in small batches: each request creates at most this many
// pages and reports back whether more remain, and the browser keeps calling
// the endpoint (already-written rows are recognized and skipped) until done.
const BATCH_SIZE = 10;

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [secret, setSecret] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [upsert, setUpsert] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [waLoading, setWaLoading] = useState(false);
  const [waSummary, setWaSummary] = useState<SyncWaScoresSummary | null>(null);
  const [waError, setWaError] = useState<string | null>(null);

  const syncWa = async (waDryRun: boolean) => {
    setWaLoading(true);
    setWaError(null);
    setWaSummary(null);
    try {
      const res = await fetch("/api/sync-wa-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret || undefined, dryRun: waDryRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWaError(data.error ?? "同期に失敗しました");
        return;
      }
      setWaSummary(data.summary);
    } catch {
      setWaError("通信エラーが発生しました");
    } finally {
      setWaLoading(false);
    }
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      // Only rows newly processed in a given round reach the dorm/value
      // checks (a row already written in an earlier round is now detected
      // and short-circuits before those checks run again), so `missingDorm`,
      // `warnings`, and `addedProperties` are each a per-round partial
      // result that must be combined across rounds. And `skippedDuplicate`
      // can't be combined at all: each round re-scans the whole file from
      // row one, so a row this same import already wrote in an earlier
      // round shows up as a duplicate again on every later round - the true
      // count is derived from `totalRows` instead, which (like
      // `skippedInvalid`) is a fixed property of the file and doesn't grow
      // with the round count.
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalMissingDorm = 0;
      let offset = 0;
      const allWarnings: string[] = [];
      const addedPropertiesSoFar: string[] = [];

      for (;;) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("dryRun", String(dryRun));
        formData.append("mode", upsert ? "upsert" : "create");
        if (secret) formData.append("secret", secret);
        if (!dryRun) {
          formData.append("maxCreate", String(BATCH_SIZE));
          formData.append("offset", String(offset));
        }

        const res = await fetch("/api/import-blood-data", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "インポートに失敗しました");
          return;
        }

        const roundSummary: ImportSummary = data.summary;
        totalCreated += roundSummary.created;
        totalUpdated += roundSummary.updated;
        totalMissingDorm += roundSummary.missingDorm;
        allWarnings.push(...roundSummary.warnings);
        for (const p of roundSummary.addedProperties) {
          if (!addedPropertiesSoFar.includes(p)) addedPropertiesSoFar.push(p);
        }

        setSummary({
          ...roundSummary,
          created: totalCreated,
          updated: totalUpdated,
          missingDorm: totalMissingDorm,
          warnings: allWarnings,
          addedProperties: addedPropertiesSoFar,
          skippedDuplicate:
            roundSummary.totalRows - totalCreated - totalUpdated - roundSummary.skippedInvalid,
        });

        if (!roundSummary.hasMore) break;
        offset = roundSummary.nextOffset;
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
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
          CSVファイルをアップロードすると、Notionの血液検査データベースに取り込みます。
          「選手名」「検査日」は必須列、「寮」「学年」は任意、それ以外の列は検査項目として自動認識されます。
        </p>
      </header>

      <section
        className="space-y-4 rounded-lg p-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
      >
        <div className="space-y-1">
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>
            CSVファイル
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
            style={{ color: "var(--text-primary)" }}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>
            パスコード（設定されている場合のみ必要）
          </label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="select w-full"
            placeholder="IMPORT_SECRET"
          />
        </div>

        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          まず内容を確認する（Notionへは書き込みません）
        </label>

        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={upsert} onChange={(e) => setUpsert(e.target.checked)} />
          既存の行も上書きする（学年など、後から追加した列を反映したいときに使用）
        </label>

        <button
          type="button"
          onClick={submit}
          disabled={!file || loading}
          className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--brand)", color: "#ffffff" }}
        >
          {loading
            ? summary
              ? `処理中... (${summary.created + summary.updated}件処理)`
              : "処理中..."
            : dryRun
              ? "内容を確認"
              : "Notionにインポート"}
        </button>
      </section>

      {error && (
        <div
          className="rounded-lg p-4 text-sm"
          style={{ background: "rgba(208, 59, 59, 0.1)", color: "var(--status-critical)" }}
        >
          {error}
        </div>
      )}

      {summary && (
        <section
          className="space-y-2 rounded-lg p-4 text-sm"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
        >
          <h2 className="font-medium" style={{ color: "var(--text-primary)" }}>
            {summary.dryRun ? "確認結果（未実行）" : "インポート結果"}
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            検査項目として扱う列: {summary.paramColumns.join(", ")}
          </p>
          {summary.addedProperties.length > 0 && (
            <p style={{ color: "var(--text-secondary)" }}>
              Notion側に新規追加{summary.dryRun ? "予定" : ""}の項目: {summary.addedProperties.join(", ")}
            </p>
          )}
          <ul className="space-y-1" style={{ color: "var(--text-primary)" }}>
            <li>{summary.dryRun ? "作成予定" : "作成"}: {summary.created}件</li>
            {summary.mode === "upsert" && (
              <li>{summary.dryRun ? "更新予定" : "更新"}: {summary.updated}件</li>
            )}
            {summary.mode === "create" && (
              <li>重複のためスキップ: {summary.skippedDuplicate}件</li>
            )}
            <li>不正な行のためスキップ: {summary.skippedInvalid}件</li>
            {summary.missingDorm > 0 && <li>寮が未記入の行: {summary.missingDorm}件</li>}
          </ul>
          {summary.warnings.length > 0 && (
            <details>
              <summary style={{ color: "var(--text-muted)", cursor: "pointer" }}>
                警告 ({summary.warnings.length}件)
              </summary>
              <ul className="mt-1 space-y-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                {summary.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          {summary.dryRun && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              内容に問題なければ、上のチェックを外してもう一度実行するとNotionに書き込まれます。
            </p>
          )}
        </section>
      )}

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
            {waLoading ? "処理中..." : "内容を確認（書き込まない）"}
          </button>
          <button
            type="button"
            onClick={() => syncWa(false)}
            disabled={waLoading}
            className="rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--brand)", color: "#ffffff" }}
          >
            {waLoading ? "処理中..." : "Notionに反映"}
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
              <li>{waSummary.dryRun ? "作成予定" : "作成"}: {waSummary.created}件</li>
              <li>{waSummary.dryRun ? "更新予定" : "更新"}: {waSummary.updated}件</li>
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
