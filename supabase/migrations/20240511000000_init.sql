-- IdleEnglish initial schema
-- Run in Supabase SQL editor or via supabase db push

create extension if not exists "uuid-ossp";

create type card_type as enum (
  'vocabulary',
  'phrase',
  'grammar_correction',
  'slang',
  'developer_english',
  'pronunciation'
);

create type learner_level as enum ('beginner', 'intermediate', 'advanced');

create table public.cards (
  id uuid primary key default uuid_generate_v4(),
  type card_type not null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  explanation text not null,
  example text not null,
  level learner_level not null default 'intermediate',
  tags text[] not null default '{}',
  audio_url text,
  created_at timestamptz not null default now()
);

create table public.saved_cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0,
  streak integer not null default 0,
  last_learned_at timestamptz,
  updated_at timestamptz not null default now()
);

create index cards_type_idx on public.cards (type);
create index cards_level_idx on public.cards (level);
create index saved_cards_user_idx on public.saved_cards (user_id);

alter table public.cards enable row level security;
alter table public.saved_cards enable row level security;
alter table public.user_progress enable row level security;

create policy "Cards are readable by authenticated users"
  on public.cards for select
  to authenticated
  using (true);

create policy "Users manage own saves"
  on public.saved_cards for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own progress"
  on public.user_progress for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.cards (type, title, content, explanation, example, level, tags, audio_url)
values
  (
    'grammar_correction',
    'Don’t say “very like”',
    '{"wrong":"I very like it","correct":"I really like it"}'::jsonb,
    '"Very" strengthens adjectives and adverbs — not verbs directly. Use “really,” “truly,” or rephrase.',
    'I really like this feature.',
    'beginner',
    array['grammar', 'common mistake'],
    null
  ),
  (
    'developer_english',
    'Ship vs deploy',
    '{"phrase":"We shipped the fix last night."}'::jsonb,
    '"Ship" implies releasing value to users; "deploy" focuses on putting bits into an environment.',
    'After QA signed off, we deployed to staging and shipped to prod Friday.',
    'intermediate',
    array['dev', 'workflow'],
    null
  ),
  (
    'vocabulary',
    'Nuanced “implement”',
    '{"term":"implement","hint":"carry out / put into effect"}'::jsonb,
    'Strong default verb in tech writing for turning a design into working software.',
    'We implemented retry logic with exponential backoff.',
    'intermediate',
    array['writing'],
    null
  ),
  (
    'slang',
    'Touch grass',
    '{"phrase":"You should touch grass.","meaning":"Go outside; stop being extremely online."}'::jsonb,
    'Playful roast / wellness check in internet culture. Mostly informal.',
    'After the third refactor today… maybe touch grass?',
    'beginner',
    array['internet', 'humor'],
    null
  ),
  (
    'phrase',
    'Soften a critique',
    '{"phrase":"Have we considered…?"}'::jsonb,
    'Question framing avoids sounding blunt while still pushing back.',
    'Have we considered caching this on the edge?',
    'advanced',
    array['meetings', 'tone'],
    null
  ),
  (
    'pronunciation',
    'Record vs replay stress',
    '{"word":"record","note":"RE-cord (noun) vs re-CORD (verb)"}'::jsonb,
    'Stress shifts meaning for many English noun/verb pairs.',
    'We keep a RE-cord of incidents and re-CORD new sessions.',
    'intermediate',
    array['stress', 'pairs'],
    null
  ),
  (
    'grammar_correction',
    'Fewer vs less',
    '{"wrong":"Less bugs","correct":"Fewer bugs"}'::jsonb,
    'Use “fewer” for countable things; “less” for mass nouns.',
    'Fewer timeouts after we tuned the pool.',
    'beginner',
    array['grammar'],
    null
  ),
  (
    'developer_english',
    'LGTM',
    '{"phrase":"Looks good to me","short":"LGTM"}'::jsonb,
    'Quick approval in PR reviews. Pair with concrete praise when possible.',
    'LGTM — nice edge-case tests!',
    'beginner',
    array['prs', 'abbrev'],
    null
  );
