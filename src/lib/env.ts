export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isYoutubeConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY?.trim());
}
