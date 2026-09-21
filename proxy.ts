import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { JOSHI_COOKIE_NAME, joshiSessionToken } from "@/lib/joshi-auth";

/**
 * /joshi（女子選手用ダッシュボード）の合言葉ゲート。
 *
 * app/joshi/page.tsx 自体はCookieを一切読まない - そうすることで男子側の
 * "/"（app/page.tsx）と同じくISR（静的生成＋バックグラウンド再検証）にでき、
 * 認証済みの訪問者にはNotionへの問い合わせを待たせず即座にキャッシュ済み
 * HTMLを返せる（以前はページ内でcookies()を読んでいたせいでforce-dynamic
 * 相当の扱いになり、毎回Notionからの再取得を待つ必要があって読み込みが
 * 遅かった）。
 *
 * その代わり、認証チェックはこのProxyがリクエストごとに必ず行う。Next.jsの
 * Proxyは、対象パスへのリクエストであればキャッシュ済みのレスポンスが返る
 * 場合も含めて毎回実行されるため、ページ側をキャッシュ可能にしても保護は
 * 途切れない。
 */
export function proxy(request: NextRequest) {
  const token = joshiSessionToken();
  const cookieValue = request.cookies.get(JOSHI_COOKIE_NAME)?.value;
  if (!token || cookieValue !== token) {
    return NextResponse.redirect(new URL("/joshi/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/joshi"],
};
