-- Saved YouTube shorts per user (metadata snapshot at save time)

create table public.saved_shorts (
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null check (char_length(video_id) >= 6 and char_length(video_id) <= 32),
  title text not null,
  channel_title text not null,
  thumbnail_url text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create index saved_shorts_user_idx on public.saved_shorts (user_id);

alter table public.saved_shorts enable row level security;

create policy "Users manage own saved shorts"
  on public.saved_shorts for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
