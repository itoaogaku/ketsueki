"use client";

import { useState } from "react";

/** /joshi用の合言葉入力フォーム。ログインAPIが成功したらページを再読み込み
 * して、サーバー側（app/joshi/page.tsx）がセットされたCookieを見て認証済み
 * としてダッシュボードを描画し直す。 */
export function JoshiLoginForm() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/joshi-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "認証に失敗しました");
        return;
      }
      window.location.reload();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col justify-center gap-4 px-4 py-8">
      <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
        女子選手用ダッシュボード
      </h1>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        合言葉を入力してください。
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          className="select"
          placeholder="合言葉"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !secret}
          className="rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--brand)", color: "#ffffff" }}
        >
          {loading ? "確認中..." : "入る"}
        </button>
        {error && (
          <p className="text-sm" style={{ color: "var(--status-critical)" }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
