"use client";

import Link from "next/link";
import { useState } from "react";
import { BloodCsvImporter } from "@/components/BloodCsvImporter";

export function JoshiImportClient() {
  const [secret, setSecret] = useState("");
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <Link href="/joshi" className="text-sm" style={{ color: "var(--brand)" }}>
          ← 女子選手用ダッシュボードに戻る
        </Link>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          女子選手 血液検査データCSVインポート
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          CSVファイルをアップロードすると、女子選手用の血液検査データベースに取り込みます。
          「選手名」「検査日」は必須列、「学年」は任意、それ以外の列は検査項目として自動認識されます。
        </p>
      </header>
      <BloodCsvImporter endpoint="/api/joshi/import-blood-data" secret={secret} onSecretChange={setSecret} />
    </div>
  );
}
