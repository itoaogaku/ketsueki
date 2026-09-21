import { Dashboard } from "@/components/Dashboard";
import { fetchBloodData, fetchGameResults, fetchWaScores, filterWaScoreResponseByGender } from "@/lib/notion";

// Statically rendered and revalidated in the background every minute (ISR),
// rather than re-run for every visitor: with the previous `force-dynamic`
// setting every single page view had to wait out a live Notion round trip
// (~20s+ once the blood-test database grew past a few hundred rows), even
// when the cached data was still fresh - `unstable_cache` alone wasn't
// enough to avoid that per-request wait. ISR instead serves the last-built
// HTML instantly and only pays the Notion round trip during the occasional
// background rebuild, on Vercel's own request-independent schedule.
//
// This does mean `next build` fetches real data at build time - in this
// project's sandboxed dev environment that has no route to api.notion.com,
// so local verification builds must explicitly blank out the Notion env vars
// (NOTION_TOKEN= NOTION_BLOOD_DATABASE_ID= ... npm run build) to fall back to
// sample data instead. Production builds on Vercel have real Notion access.
export const revalidate = 60;

export default async function Home() {
  const [bloodData, gameData, waData] = await Promise.all([
    fetchBloodData(),
    fetchGameResults(),
    fetchWaScores(),
  ]);
  return (
    <Dashboard
      bloodData={bloodData}
      gameSource={gameData.source}
      waData={filterWaScoreResponseByGender(waData, "m")}
    />
  );
}
