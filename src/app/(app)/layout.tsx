import { BottomNav } from "@/components/layout/bottom-nav";
import { PersistentFeedShell } from "@/components/feed/persistent-feed-shell";
import { fetchSavedIds, fetchSavedShortRows } from "@/app/actions/saved";

export const dynamic = "force-dynamic";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [savedIdsForFeed, initialRemoteSavedShorts] = await Promise.all([
    fetchSavedIds(),
    fetchSavedShortRows(),
  ]);

  return (
    <div className="relative mx-auto flex h-dvh min-h-0 w-full max-w-lg flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 flex-col pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
        <PersistentFeedShell
          initialSavedIds={savedIdsForFeed}
          initialRemoteSavedShorts={initialRemoteSavedShorts}
        >
          {children}
        </PersistentFeedShell>
      </div>
      <BottomNav />
    </div>
  );
}
