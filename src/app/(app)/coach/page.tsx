import { AiCoach } from "@/components/coach/ai-coach";
import { AppHeader } from "@/components/layout/app-header";
import { fetchCoachChatRemote } from "@/app/actions/coach-chats";

export const metadata = {
  title: "AI Coach · IdleEnglish",
  description:
    "Practice English with AI — choose a topic, get corrections, and level-matched prompts.",
};

export default async function CoachPage() {
  const coachRemote = await fetchCoachChatRemote();

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader
        eyebrow="IdleEnglish"
        title="AI Coach"
        showFeedShortcut
        singleLine
      />
      <AiCoach coachRemote={coachRemote} />
    </main>
  );
}
