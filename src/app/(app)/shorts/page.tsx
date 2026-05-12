import { AppHeader } from "@/components/layout/app-header";
import { fetchSavedShortRows } from "@/app/actions/saved";
import { ShortsFeed } from "@/components/shorts/shorts-feed";

export const metadata = {
  title: "Shorts · IdleEnglish",
  description: "Swipe English-learning clips from YouTube.",
};

export default async function ShortsPage() {
  const remoteSavedShorts = await fetchSavedShortRows();

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader
        singleLine
        eyebrow="IdleEnglish"
        title="English Shorts"
        showFeedShortcut
      />
      <ShortsFeed initialRemoteSavedShorts={remoteSavedShorts} />
    </main>
  );
}
