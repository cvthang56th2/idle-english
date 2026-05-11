import { DEMO_LESSON_CARDS, rowToLessonCard } from "@/data/demo-cards";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean).slice(0, 48) : [];

  if (!ids.length) {
    return Response.json({ items: [] as ReturnType<typeof rowToLessonCard>[] });
  }

  if (!isSupabaseConfigured()) {
    const demoMap = new Map(DEMO_LESSON_CARDS.map((c) => [c.id, c]));
    const items = ids
      .map((id) => demoMap.get(id))
      .filter(Boolean) as typeof DEMO_LESSON_CARDS;
    return Response.json({ items });
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return Response.json({ items: [] });
  }

  const { data, error } = await supabase.from("cards").select("*").in("id", ids);

  if (error || !data) {
    return Response.json({ items: [] });
  }

  return Response.json({
    items: data.map(rowToLessonCard),
  });
}
