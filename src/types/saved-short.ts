/** Snapshot stored when user saves a short (local + optional Supabase row). */
export type SavedShortSnapshot = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  savedAt: number;
};
