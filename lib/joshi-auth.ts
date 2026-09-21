import { createHmac, timingSafeEqual } from "crypto";

/** /joshi（女子選手用フルダッシュボード）を守るパスコードゲート。IMPORT_SECRET
 * と同じ「共有の合言葉」方式だが、こちらはブラウザに残るCookieで認証状態を
 * 保持する必要があるため、合言葉そのものをCookieに入れるのは避け、
 * サーバーだけが持つ合言葉をキーにしたHMACトークンを入れる - Cookieの値を
 * 見ても合言葉自体は分からず、かつサーバー側はその場で再計算するだけで
 * 検証でき、セッションをどこかに保存しておく必要もない。 */
const COOKIE_NAME = "joshi_session";
const TOKEN_PURPOSE = "joshi-dashboard-v1";

export const JOSHI_COOKIE_NAME = COOKIE_NAME;

export function isJoshiSecretConfigured(): boolean {
  return Boolean(process.env.WOMEN_DASHBOARD_SECRET);
}

/** 入力された合言葉が正しいか（ログインAPIでのみ使用）。 */
export function checkJoshiPasscode(input: string): boolean {
  const secret = process.env.WOMEN_DASHBOARD_SECRET;
  if (!secret) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** 現在の合言葉から決定的に計算されるセッショントークン。合言葉が
 * 設定されていなければ null（＝/joshiはどんな入力でも認証されない）。 */
export function joshiSessionToken(): string | null {
  const secret = process.env.WOMEN_DASHBOARD_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(TOKEN_PURPOSE).digest("hex");
}
