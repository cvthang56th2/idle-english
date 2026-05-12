import { fetchProgress } from "@/app/actions/progress";
import { AppHeader } from "@/components/layout/app-header";
import { ProfileDashboard } from "@/components/profile/profile-dashboard";
import { getAuthSyncSummary } from "@/lib/auth-sync";

export const metadata = {
  title: "Profile · IdleEnglish",
  description: "Account, installs, and saved-cards sync for IdleEnglish.",
};

export default async function ProfilePage() {
  const [progress, authSync] = await Promise.all([
    fetchProgress(),
    getAuthSyncSummary(),
  ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader
        eyebrow="Progress"
        title="Profile"
        detail="Small wins compound — especially between builds."
      />
      <ProfileDashboard
        remoteXp={progress.xp}
        remoteStreak={progress.streak}
        lastLearnedAt={progress.lastLearnedAt}
        authSync={authSync}
      />
    </main>
  );
}
