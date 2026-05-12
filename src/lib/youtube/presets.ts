/** Curated search terms for vertical bite-sized English videos (often tagged #shorts). */
export const YOUTUBE_CATEGORY_QUERIES: Record<
  string,
  { label: string; q: string }
> = {
  explore: {
    label: "Explore",
    q: "english learning #shorts",
  },
  grammar: {
    label: "Grammar",
    q: "english grammar lesson #shorts",
  },
  pronunciation: {
    label: "Pronunciation",
    q: "english pronunciation practice #shorts",
  },
  vocabulary: {
    label: "Vocabulary",
    q: "english vocabulary #shorts",
  },
  listening: {
    label: "Listening",
    q: "english listening practice short",
  },
  idioms: {
    label: "Idioms",
    q: "english idioms explained #shorts",
  },
  phrasal: {
    label: "Phrasal verbs",
    q: "english phrasal verbs #shorts",
  },
};

export type EnglishChannelPreset = {
  id: string;
  title: string;
  locale: string;
};

/** Stable channel IDs for well-known English learning publishers. */
export const ENGLISH_LEARNING_CHANNELS: EnglishChannelPreset[] = [
  {
    id: "UCHaHD477h-FeBbVh9Sh7syA",
    title: "BBC Learning English",
    locale: "UK",
  },
  {
    id: "UCKRBA9XfgzAtJodE4t8cUeg",
    title: "engVid",
    locale: "CA",
  },
  {
    id: "UCz4tgANd4yy8Oe0iXCdSWfA",
    title: "English with Lucy",
    locale: "UK",
  },
  {
    id: "UCrRiVfHqBIIvSgKmgnSY66g",
    title: "mmmEnglish",
    locale: "AU",
  },
];
