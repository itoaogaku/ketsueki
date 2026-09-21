import { cookies } from "next/headers";
import { Dashboard } from "@/components/Dashboard";
import { JoshiLoginForm } from "@/components/JoshiLoginForm";
import { JOSHI_COOKIE_NAME, joshiSessionToken } from "@/lib/joshi-auth";
import { fetchGameResults, fetchWaScores, fetchWomenBloodData, filterWaScoreResponseByGender } from "@/lib/notion";

// 男子側の "/" とは違い、ここはISR（静的生成＋バックグラウンド再検証）には
// できない - このページはCookie（合言葉の認証状態）によって返す内容が訪問者
// ごとに変わるが、ISRはビルド時や再検証時に生成した「1つのHTML」を全訪問者
// に使い回す。再検証のタイミング次第では認証済み（女子選手の実データ入り）
// のHTMLがキャッシュされ、合言葉を知らない次の訪問者にそのまま配信されて
// しまう恐れがある。force-dynamicでリクエストごとにCookieを見て毎回描画し
// 直すことで、この漏洩経路を防ぐ。
export const dynamic = "force-dynamic";

// 検索エンジンにインデックスされたり、他ページのリンク一覧などに拾われたり
// しないように。男子チームから見えないようにする対策の一部（URLと合言葉を
// 知っている人だけが辿り着ける想定）。
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function JoshiPage() {
  const token = joshiSessionToken();
  if (!token) {
    return <JoshiLoginForm />;
  }
  const cookieStore = await cookies();
  const authed = cookieStore.get(JOSHI_COOKIE_NAME)?.value === token;
  if (!authed) {
    return <JoshiLoginForm />;
  }

  const [bloodData, gameData, waData] = await Promise.all([
    fetchWomenBloodData(),
    fetchGameResults(),
    fetchWaScores(),
  ]);
  return (
    <Dashboard
      bloodData={bloodData}
      gameSource={gameData.source}
      waData={filterWaScoreResponseByGender(waData, "f")}
      title="女子選手用ダッシュボード"
      description="女子選手の血液検査データの推移を確認できます。"
      showImportLink={false}
    />
  );
}
