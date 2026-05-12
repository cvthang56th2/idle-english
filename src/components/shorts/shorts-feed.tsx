"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import {
  Bookmark,
  Clapperboard,
  Library,
  Loader2,
  Radio,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import type { YoutubeSearchVideo } from "@/lib/youtube/types";
import {
  DEFAULT_SHORTS_THEME_ID,
  SHORTS_THEMES,
  getShortsTheme,
  type ShortsTheme,
} from "@/lib/youtube/themes";
import { ENGLISH_LEARNING_CHANNELS } from "@/lib/youtube/presets";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toggleSavedShort } from "@/app/actions/saved";
import {
  removeSavedShortEntry,
  syncSavedShortsFromRemote,
  upsertSavedShortEntry,
} from "@/lib/saved-shorts-storage";
import type { SavedShortSnapshot } from "@/types/saved-short";
import {
  isYoutubeSearchOrder,
  type YoutubeSearchOrder,
} from "@/lib/youtube/search-server";

type SearchApiOk = {
  ok: true;
  items: YoutubeSearchVideo[];
  nextPageToken?: string;
};

type SearchApiErr = {
  ok: false;
  error?: string;
  message?: string;
};

const REFRESH_ORDER_POOL: YoutubeSearchOrder[] = [
  "relevance",
  "date",
  "viewCount",
  "rating",
  "title",
];

/** Biases YouTube search toward a different slice of the catalog on each refresh. */
function randomPublishedAfterForMix(): string {
  const start = Date.UTC(2018, 0, 1);
  const end = Date.now() - 5 * 24 * 60 * 60 * 1000;
  const u = start + Math.random() * (end - start);
  return new Date(u).toISOString();
}

function shuffleArray<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i]!;
    out[i] = out[j]!;
    out[j] = t;
  }
  return out;
}

const SHORTS_FILTERS_STORAGE_KEY = "idle-english:shorts-filters:v1";

type ShortsFiltersSnapshot = {
  themeId: string;
  channelId: string | null;
  channelTitle: string | null;
  searchDraft: string;
  debouncedSearch: string;
  durationShort: boolean;
  manualSortOrder: YoutubeSearchOrder | null;
};

function isPersistedThemeId(id: unknown): id is string {
  return typeof id === "string" && SHORTS_THEMES.some((t) => t.id === id);
}

function readShortsFiltersFromStorage(): ShortsFiltersSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SHORTS_FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.v !== 1) return null;

    if (!isPersistedThemeId(p.themeId)) return null;

    let channelId: string | null = null;
    if (typeof p.channelId === "string" && p.channelId.trim()) {
      channelId = p.channelId.trim();
    }

    const searchDraft = typeof p.searchDraft === "string" ? p.searchDraft : "";
    const debouncedSearch =
      typeof p.debouncedSearch === "string" ? p.debouncedSearch : searchDraft;
    const durationShort =
      typeof p.durationShort === "boolean" ? p.durationShort : true;

    let manualSortOrder: YoutubeSearchOrder | null = null;
    if (
      typeof p.manualSortOrder === "string" &&
      isYoutubeSearchOrder(p.manualSortOrder)
    ) {
      manualSortOrder = p.manualSortOrder;
    }

    let channelTitle: string | null =
      typeof p.channelTitle === "string" ? p.channelTitle : null;
    if (channelId) {
      const preset = ENGLISH_LEARNING_CHANNELS.find((c) => c.id === channelId);
      if (preset) channelTitle = preset.title;
    }

    return {
      themeId: p.themeId,
      channelId,
      channelTitle,
      searchDraft,
      debouncedSearch,
      durationShort,
      manualSortOrder,
    };
  } catch {
    return null;
  }
}

function buildQuery(opts: {
  theme: ShortsTheme;
  channelId: string | null;
  debouncedSearch: string;
  pageToken?: string;
  durationShort: boolean;
  sortOrder?: YoutubeSearchOrder | null;
  mixPublishedAfter?: string | null;
}) {
  const p = new URLSearchParams();
  if (opts.channelId) {
    p.set("channelId", opts.channelId);
  } else if (opts.debouncedSearch.trim()) {
    p.set("q", opts.debouncedSearch.trim());
  } else {
    const { load } = opts.theme;
    if (load.type === "preset") {
      p.set("category", load.key);
    } else {
      p.set("q", load.q);
    }
  }
  if (opts.pageToken) {
    p.set("pageToken", opts.pageToken);
  }
  if (!opts.durationShort) {
    p.set("duration", "any");
  }
  if (opts.sortOrder) {
    p.set("order", opts.sortOrder);
  }
  if (opts.mixPublishedAfter && !opts.pageToken) {
    p.set("publishedAfter", opts.mixPublishedAfter);
  }
  return p.toString();
}

function embedUrl(videoId: string) {
  const q = new URLSearchParams({
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    autoplay: "1",
    mute: "0",
    enablejsapi: "1",
    /** YouTube requires `playlist` to the same id for `loop` to take effect on a single video. */
    loop: "1",
    playlist: videoId,
  });
  return `https://www.youtube.com/embed/${videoId}?${q.toString()}`;
}

export function ShortsFeed({
  initialRemoteSavedShorts,
  /** When false (e.g. another bottom tab is active), the embed is unmounted so playback stops. */
  playbackActive = true,
}: {
  initialRemoteSavedShorts: SavedShortSnapshot[];
  playbackActive?: boolean;
}) {
  const [themeId, setThemeId] = useState(DEFAULT_SHORTS_THEME_ID);
  const theme = useMemo(() => getShortsTheme(themeId), [themeId]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelTitle, setChannelTitle] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [durationShort, setDurationShort] = useState(true);

  const filterKey = useMemo(
    () =>
      `${themeId}\u0000${channelId ?? ""}\u0000${debouncedSearch}\u0000${durationShort}`,
    [themeId, channelId, debouncedSearch, durationShort],
  );
  const [refreshSortKey, setRefreshSortKey] = useState(filterKey);
  const [manualSortOrder, setManualSortOrder] =
    useState<YoutubeSearchOrder | null>(null);
  /** Random floor date for YouTube mix — set on “Refresh”, cleared when filters change; not persisted. */
  const [mixPublishedAfter, setMixPublishedAfter] = useState<string | null>(
    null,
  );
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  if (filterKey !== refreshSortKey) {
    setRefreshSortKey(filterKey);
    setManualSortOrder(null);
    setMixPublishedAfter(null);
  }

  const [videos, setVideos] = useState<YoutubeSearchVideo[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const [savePending, startSaveTransition] = useTransition();
  const [savedVideoIds, setSavedVideoIds] = useState(() => {
    const merged = syncSavedShortsFromRemote(initialRemoteSavedShorts);
    return new Set(merged.map((e) => e.videoId));
  });

  useEffect(() => {
    const saved = readShortsFiltersFromStorage();
    if (saved) {
      const fk = `${saved.themeId}\u0000${saved.channelId ?? ""}\u0000${saved.debouncedSearch}\u0000${saved.durationShort}`;
      setThemeId(saved.themeId);
      setChannelId(saved.channelId);
      setChannelTitle(saved.channelTitle);
      setSearchDraft(saved.searchDraft);
      setDebouncedSearch(saved.debouncedSearch);
      setDurationShort(saved.durationShort);
      setManualSortOrder(saved.manualSortOrder);
      setRefreshSortKey(fk);
    }
    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchDraft), 380);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    if (!filtersHydrated) return;
    try {
      window.localStorage.setItem(
        SHORTS_FILTERS_STORAGE_KEY,
        JSON.stringify({
          v: 1,
          themeId,
          channelId,
          channelTitle,
          searchDraft,
          debouncedSearch,
          durationShort,
          manualSortOrder,
        }),
      );
    } catch {
      /* quota / private mode */
    }
  }, [
    filtersHydrated,
    themeId,
    channelId,
    channelTitle,
    searchDraft,
    debouncedSearch,
    durationShort,
    manualSortOrder,
  ]);

  const fetchPage = useCallback(
    async (pageToken: string | undefined, append: boolean) => {
      const query = buildQuery({
        theme,
        channelId,
        debouncedSearch,
        pageToken,
        durationShort,
        sortOrder: manualSortOrder,
        mixPublishedAfter,
      });
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const res = await fetch(`/api/youtube/search?${query}`, {
        cache: "no-store",
        signal: ac.signal,
      });
      const data = (await res.json()) as SearchApiOk | SearchApiErr;

      if (!res.ok || !data.ok) {
        const err = data as SearchApiErr;
        if (err.error === "missing_key" || err.error === "youtube_quota") {
          setConfigError(err.message ?? "YouTube API unavailable.");
        } else {
          const raw = err.message ?? "Couldn’t load videos.";
          toast.error(raw.replace(/<[^>]*>/g, "").trim() || "Couldn’t load videos.");
        }
        if (!append) setVideos([]);
        setNextPageToken(undefined);
        return;
      }

      setConfigError(null);
      const payload = data as SearchApiOk;
      const nextItems =
        !append && mixPublishedAfter
          ? shuffleArray(payload.items)
          : payload.items;
      setVideos((prev) => {
        if (!append) return nextItems;
        const seen = new Set(prev.map((v) => v.videoId));
        const merged = [...prev];
        for (const v of nextItems) {
          if (!seen.has(v.videoId)) {
            seen.add(v.videoId);
            merged.push(v);
          }
        }
        return merged;
      });
      setNextPageToken(payload.nextPageToken);
    },
    [
      theme,
      channelId,
      debouncedSearch,
      durationShort,
      manualSortOrder,
      mixPublishedAfter,
    ],
  );

  const refreshFeed = useCallback(() => {
    setMixPublishedAfter(randomPublishedAfterForMix());
    const pool = REFRESH_ORDER_POOL.filter((o) => o !== manualSortOrder);
    const next =
      pool[Math.floor(Math.random() * pool.length)] ?? REFRESH_ORDER_POOL[0];
    setManualSortOrder(next);
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [manualSortOrder]);

  useEffect(() => {
    if (!filtersHydrated) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setActiveIndex(0);
      try {
        await fetchPage(undefined, false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage, filtersHydrated]);

  const loadMore = useCallback(async () => {
    if (!nextPageToken || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await fetchPage(nextPageToken, true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage, nextPageToken]);

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore();
        }
      },
      { root, rootMargin: "240px", threshold: 0 },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [loadMore, videos.length]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const slides = root.querySelectorAll<HTMLElement>("[data-short-slide]");
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            const idx = Number(e.target.getAttribute("data-index"));
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root, threshold: [0.25, 0.5, 0.65] },
    );
    slides.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [videos]);

  const thumbFor = useCallback((v: YoutubeSearchVideo) => {
    return (
      v.thumbnailUrl || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
    );
  }, []);

  function handleToggleSave(v: YoutubeSearchVideo) {
    const next = !savedVideoIds.has(v.videoId);
    setSavedVideoIds((prev) => {
      const n = new Set(prev);
      if (next) n.add(v.videoId);
      else n.delete(v.videoId);
      return n;
    });
    startSaveTransition(async () => {
      const payload = {
        videoId: v.videoId,
        title: v.title,
        channelTitle: v.channelTitle,
        thumbnailUrl: thumbFor(v),
      };
      const result = await toggleSavedShort(payload, next);
      if (!result.ok) {
        const msg =
          result.error === "invalid_video"
            ? "Could not save this clip."
            : result.error;
        toast.error(msg);
        setSavedVideoIds((prev) => {
          const n = new Set(prev);
          if (next) n.delete(v.videoId);
          else n.add(v.videoId);
          return n;
        });
        return;
      }
      if (next) {
        upsertSavedShortEntry(payload);
      } else {
        removeSavedShortEntry(v.videoId);
      }
    });
  }

  /** Bottom nav + safe areas + compact page header + toolbar — sizes each snap slide to the visible frame. */
  const shortsChromeBottom =
    "calc(5.25rem + env(safe-area-inset-bottom) + env(safe-area-inset-top) + 9rem)";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border/60 px-2 pb-2 pt-0.5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 max-w-[42%] shrink-0 gap-1.5 px-2"
            onClick={() => setTopicsOpen(true)}
            title={theme.description}
          >
            <Library className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate text-left font-medium">{theme.title}</span>
          </Button>
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-muted/40 px-2.5">
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={searchDraft}
              onChange={(e) => {
                setSearchDraft(e.target.value);
                setChannelId(null);
                setChannelTitle(null);
              }}
              placeholder="Search…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search videos"
            />
          </div>
          <Button
            type="button"
            variant={channelId ? "default" : "outline"}
            size="sm"
            className="h-9 shrink-0 gap-1 px-2.5"
            onClick={() => setChannelsOpen(true)}
          >
            <Radio className="size-3.5" />
            Channels
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            disabled={loading || Boolean(configError)}
            onClick={refreshFeed}
            title="Random mix — new time window, sort, and order"
            aria-label="Load a random new batch of shorts"
          >
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-0.5 text-[10px] text-muted-foreground">
          <span className="min-w-0 truncate leading-tight">
            {channelId
              ? channelTitle ?? "Channel selected"
              : debouncedSearch.trim()
                ? `“${debouncedSearch.trim()}”`
                : theme.description}
          </span>
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={durationShort}
              onChange={(e) => setDurationShort(e.target.checked)}
              className="rounded border-border"
            />
            Short clips (&lt; 4 min)
          </label>
        </div>
      </div>

      {configError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Clapperboard className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{configError}</p>
        </div>
      ) : null}

      {!configError && loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      ) : null}

      {!configError && !loading && videos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm text-muted-foreground">
            No matching videos. Try another topic, turn off the duration filter, or use search / channels.
          </p>
        </div>
      ) : null}

      {!configError && videos.length > 0 ? (
        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto scroll-smooth"
        >
          {videos.map((v, i) => (
            <article
              key={`${v.videoId}-${i}`}
              data-short-slide
              data-index={i}
              className={cn(
                "snap-start flex flex-col justify-center border-b border-border/40 px-2 py-2",
                "min-h-[calc(100dvh-var(--shorts-chrome))]",
              )}
              style={
                {
                  "--shorts-chrome": shortsChromeBottom,
                } as CSSProperties
              }
            >
              <div
                className={cn(
                  "relative mx-auto w-full max-w-full overflow-hidden rounded-2xl border border-border/80 bg-black shadow-xl",
                  "aspect-9/16 max-h-[calc(100dvh-var(--shorts-chrome))] w-[min(100%,calc((100dvh-var(--shorts-chrome))*9/16))]",
                )}
              >
                <div className="relative h-full w-full">
                  <div className="absolute right-2 top-1/2 translate-y-1/2 z-20">
                    <Button
                      type="button"
                      size="icon-lg"
                      variant={
                        savedVideoIds.has(v.videoId) ? "default" : "secondary"
                      }
                      disabled={savePending}
                      className={cn(
                        "rounded-full border border-white/15 bg-black/45 shadow-lg backdrop-blur-sm hover:bg-black/55",
                        savedVideoIds.has(v.videoId) &&
                        "border-primary/40 bg-primary text-primary-foreground",
                      )}
                      aria-pressed={savedVideoIds.has(v.videoId)}
                      aria-label={
                        savedVideoIds.has(v.videoId)
                          ? "Saved — tap to remove"
                          : "Save short"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSave(v);
                      }}
                    >
                      <Bookmark
                        className={cn(
                          "size-6",
                          savedVideoIds.has(v.videoId) && "fill-current",
                        )}
                      />
                    </Button>
                  </div>
                  {i === activeIndex && playbackActive ? (
                    <iframe
                      title={v.title}
                      src={embedUrl(v.videoId)}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full border-0"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnails
                    <img
                      src={
                        v.thumbnailUrl ||
                        `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
                      }
                      alt=""
                      className="h-full w-full object-cover opacity-85"
                    />
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/35 to-transparent px-3 pb-3 pt-12">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">
                      {v.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-white/80">{v.channelTitle}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}

          <div ref={sentinelRef} className="h-2 w-full shrink-0" aria-hidden />

          {loadingMore ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}
        </div>
      ) : null}

      <Sheet open={topicsOpen} onOpenChange={setTopicsOpen}>
        <SheetContent side="bottom" className="max-h-[min(78dvh,560px)]">
          <SheetHeader>
            <SheetTitle>Topic playlists</SheetTitle>
            <SheetDescription>
              Each topic keeps one learning angle. Scroll the feed for more of the same theme.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-2 h-[min(54dvh,420px)] pr-3">
            <ul className="space-y-2 pb-4">
              {SHORTS_THEMES.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                      t.id === themeId && !channelId && !debouncedSearch.trim()
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted/60",
                    )}
                    onClick={() => {
                      setThemeId(t.id);
                      setChannelId(null);
                      setChannelTitle(null);
                      setSearchDraft("");
                      setDebouncedSearch("");
                      setTopicsOpen(false);
                    }}
                  >
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{t.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {t.description}
                      </p>
                    </div>
                    {t.id === themeId ? (
                      <span className="shrink-0 text-[10px] font-semibold uppercase text-primary">
                        Now
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Sheet open={channelsOpen} onOpenChange={setChannelsOpen}>
        <SheetContent side="bottom" className="max-h-[min(70dvh,520px)]">
          <SheetHeader>
            <SheetTitle>English-learning channels</SheetTitle>
            <SheetDescription>
              Latest uploads from each channel (YouTube Data API). Pick one to browse.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="mt-2 h-[min(50dvh,360px)] pr-3">
            <ul className="space-y-1 pb-4">
              {ENGLISH_LEARNING_CHANNELS.map((ch) => (
                <li key={ch.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                      channelId === ch.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted/60",
                    )}
                    onClick={() => {
                      setChannelId(ch.id);
                      setChannelTitle(ch.title);
                      setSearchDraft("");
                      setDebouncedSearch("");
                      setChannelsOpen(false);
                    }}
                  >
                    <span className="font-medium">{ch.title}</span>
                    <span className="text-xs text-muted-foreground">{ch.locale}</span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
          {channelId ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setChannelId(null);
                setChannelTitle(null);
                setChannelsOpen(false);
              }}
            >
              Clear channel filter
            </Button>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
