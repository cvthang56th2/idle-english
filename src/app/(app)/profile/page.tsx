import { fetchProgress } from "@/app/actions/progress";
import { AppHeader } from "@/components/layout/app-header";
import { ProfileDashboard } from "@/components/profile/profile-dashboard";

export const metadata = {
  title: "Profile · IdleEnglish",
  description: "XP, streaks, and install hooks for IdleEnglish.",
};

export default async function ProfilePage() {
  const progress = await fetchProgress();

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
      />
    </main>
  );
}
