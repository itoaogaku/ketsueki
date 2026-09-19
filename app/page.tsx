import { Dashboard } from "@/components/Dashboard";
import { fetchBloodData, fetchGameResults } from "@/lib/notion";

// Notion is the source of truth and can change between visits, so always
// fetch fresh rather than serving a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [bloodData, gameData] = await Promise.all([fetchBloodData(), fetchGameResults()]);
  return <Dashboard bloodData={bloodData} gameData={gameData} />;
}
