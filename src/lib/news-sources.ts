/** Free public RSS feeds for developer reading (no API keys). */

export type NewsSourceDef = {
  id: string;
  label: string;
  hint: string;
  feedUrl: string;
};

export const NEWS_SOURCES: NewsSourceDef[] = [
  {
    id: "dev-to-feed",
    label: "DEV Community",
    hint: "Posts from the dev.to community — tutorials and discussion.",
    feedUrl: "https://dev.to/feed",
  },
  {
    id: "hackernews-front",
    label: "Hacker News",
    hint: "Front page links via hnrss — tech and startups.",
    feedUrl: "https://hnrss.org/frontpage",
  },
  {
    id: "freecodecamp-news",
    label: "freeCodeCamp News",
    hint: "Long-form guides and learning articles.",
    feedUrl: "https://www.freecodecamp.org/news/rss/",
  },
];

export const NEWS_SOURCE_IDS = new Set(
  NEWS_SOURCES.map((s) => s.id),
);

export function getNewsSource(id: string): NewsSourceDef | undefined {
  return NEWS_SOURCES.find((s) => s.id === id);
}
