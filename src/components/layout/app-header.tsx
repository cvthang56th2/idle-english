import Link from "next/link";

export function AppHeader({
  eyebrow,
  title,
  detail,
  showFeedShortcut = true,
  placement = "top",
  compact = false,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  showFeedShortcut?: boolean;
  placement?: "top" | "bottom";
  /** Tighter typography and padding — for immersive surfaces like Shorts. */
  compact?: boolean;
}) {
  return (
    <header
      className={
        placement === "bottom"
          ? "space-y-1 border-t border-border/60 px-4 pb-3 pt-3"
          : compact
            ? "space-y-0.5 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
            : "space-y-1 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      }
    >
      <p
        className={
          compact
            ? "text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            : "text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground"
        }
      >
        {eyebrow}
      </p>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1
            className={
              compact
                ? "text-xl font-semibold tracking-tight"
                : "text-2xl font-semibold tracking-tight"
            }
          >
            {title}
          </h1>
          {detail ? (
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          ) : null}
        </div>
        {showFeedShortcut ? (
          <Link
            href="/feed"
            className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Feed
          </Link>
        ) : null}
      </div>
    </header>
  );
}
