/** Curated English-learning oriented RSS feeds (server-fetchable without auth). */

export type NewsSourceDef = {
  id: string;
  label: string;
  hint: string;
  feedUrl: string;
};

/** Ids-only list for iterating / validation. Enable all by default via preferences layer. */
export const NEWS_SOURCES: NewsSourceDef[] = [
  {
    id: "cambridge-about-words",
    label: "Cambridge Dictionary blog",
    hint: "Short vocabulary and usage notes.",
    feedUrl: "https://dictionaryblog.cambridge.org/feed/",
  },
  {
    id: "guardian-education",
    label: "The Guardian · Education",
    hint: "School and learning stories in plain English.",
    feedUrl:
      "https://www.theguardian.com/education/rss",
  },
  {
    id: "bbc-world",
    label: "BBC News · World",
    hint: "Global headlines — good for skim reading.",
    feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    id: "npr-top",
    label: "NPR · News headlines",
    hint: "US public radio summaries — conversational tone.",
    feedUrl: "https://www.npr.org/rss/rss.php?id=1001",
  },
];

export const NEWS_SOURCE_IDS = new Set(
  NEWS_SOURCES.map((s) => s.id),
);

export function getNewsSource(id: string): NewsSourceDef | undefined {
  return NEWS_SOURCES.find((s) => s.id === id);
}
