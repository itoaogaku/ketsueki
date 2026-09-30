import { JoshiImportClient } from "./JoshiImportClient";

// 合言葉のチェックは proxy.ts が行う（/joshi と同じ）。
export const metadata = {
  robots: { index: false, follow: false },
};

export default function JoshiImportPage() {
  return <JoshiImportClient />;
}
