import { Dashboard } from "@/components/Dashboard";
import { fetchGameResults, fetchWaScores, fetchWomenBloodData, filterWaScoreResponseByGender } from "@/lib/notion";

// 認証チェックはproxy.ts（リクエストごとに必ず実行される）が担当し、この
// ページ自体は合言葉のCookieを一切読まない。おかげで、男子側の "/"
// （app/page.tsxのコメント参照）と同じくISR（静的生成＋バックグラウンド
// 再検証）にでき、認証済みの訪問者には即座にキャッシュ済みHTMLを返せる。
export const revalidate = 60;

// 検索エンジンにインデックスされたり、他ページのリンク一覧などに拾われたり
// しないように。男子チームから見えないようにする対策の一部（URLと合言葉を
// 知っている人だけが辿り着ける想定）。
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function JoshiPage() {
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
