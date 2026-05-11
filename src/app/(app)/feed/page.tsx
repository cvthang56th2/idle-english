import { SwipeFeed } from "@/components/feed/swipe-feed";
import { AppHeader } from "@/components/layout/app-header";
import { fetchSavedIds } from "@/app/actions/saved";

export const metadata = {
  title: "Learn · IdleEnglish",
  description: "Swipe through micro English lessons while you wait.",
};

export default async function FeedPage() {
  const savedIds = await fetchSavedIds();

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader
        eyebrow="IdleEnglish"
        title="Learn in the gaps"
        detail="Vertical micro-lessons · swipe up"
        showFeedShortcut={false}
      />
      <SwipeFeed initialSavedIds={savedIds} />
    </main>
  );
}
