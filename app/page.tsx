import { Dashboard } from "@/components/Dashboard";
import { fetchBloodData, fetchGameResults } from "@/lib/notion";

// The page itself always renders per-request (fetchBloodData/fetchGameResults
// in lib/notion.ts already cache their Notion results for 60s internally, so
// this doesn't mean an uncached Notion round trip on every visit - it just
// keeps this page from being statically generated at build time, which in
// this project's sandboxed dev environment has no route to api.notion.com).
export const dynamic = "force-dynamic";

export default async function Home() {
  const [bloodData, gameData] = await Promise.all([fetchBloodData(), fetchGameResults()]);
  return <Dashboard bloodData={bloodData} gameData={gameData} />;
}
