import { fetchProgress } from "@/app/actions/progress";
import { AppHeader } from "@/components/layout/app-header";
import { ProfileDashboard } from "@/components/profile/profile-dashboard";
import { getAuthSyncSummary } from "@/lib/auth-sync";

export const metadata = {
  title: "Profile · IdleEnglish",
  description: "XP, streaks, and install hooks for IdleEnglish.",
};

export default async function ProfilePage() {
  const [progress, authSync] = await Promise.all([
    fetchProgress(),
    getAuthSyncSummary(),
  ]);

  return (
    <main className="flex flex-1 flex-col">
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
