import { DEMO_LESSON_CARDS, rowToLessonCard } from "@/data/demo-cards";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 8;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0"));
  const rawLimit = Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT));
  const limit = Math.min(Math.max(1, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT), 24);

  if (!isSupabaseConfigured()) {
    const items = Array.from({ length: limit }, (_, i) => {
      const card = DEMO_LESSON_CARDS[(offset + i) % DEMO_LESSON_CARDS.length];
      return { ...card };
    });
    return Response.json({
      items,
      nextOffset: offset + limit,
    });
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    const items = Array.from({ length: limit }, (_, i) => {
      const card = DEMO_LESSON_CARDS[(offset + i) % DEMO_LESSON_CARDS.length];
      return { ...card };
    });
    return Response.json({ items, nextOffset: offset + limit });
  }

  const rowsResult = await Promise.race([
    supabase
      .from("cards")
      .select("*")
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);

  const data = rowsResult?.data;
  const error = rowsResult?.error;

  if (error || !data?.length) {
    const items = Array.from({ length: limit }, (_, i) => {
      const card = DEMO_LESSON_CARDS[(offset + i) % DEMO_LESSON_CARDS.length];
      return { ...card };
    });
    return Response.json({ items, nextOffset: offset + limit });
  }

  return Response.json({
    items: data.map(rowToLessonCard),
    nextOffset: offset + data.length,
  });
}
