-- Saved reading-list articles per user

create table public.saved_news (
  user_id uuid not null references auth.users (id) on delete cascade,
  article_url text not null check (
    char_length(article_url) >= 12
      and char_length(article_url) <= 2048
  ),
  title text not null check (char_length(title) between 1 and 512),
  source_id text not null check (
    char_length(source_id) between 1 and 64
  ),
  source_label text not null default '' check (
    char_length(source_label) <= 256
  ),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, article_url)
);

create index saved_news_user_idx on public.saved_news (user_id);

alter table public.saved_news enable row level security;

create policy "Users manage own saved news items"
  on public.saved_news for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
