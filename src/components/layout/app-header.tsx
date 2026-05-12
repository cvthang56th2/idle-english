import Link from "next/link";

export function AppHeader({
  eyebrow,
  title,
  detail,
  showFeedShortcut = true,
  placement = "top",
  compact = false,
  /** One short row + minimal padding to maximize content below. */
  singleLine = false,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  showFeedShortcut?: boolean;
  placement?: "top" | "bottom";
  /** Tighter typography and padding — for immersive surfaces like Shorts. */
  compact?: boolean;
  singleLine?: boolean;
}) {
  if (singleLine) {
    return (
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-1 pt-[max(0.25rem,env(safe-area-inset-top))] pb-1.5">
        <h1 className="min-w-0 truncate text-xs font-semibold leading-tight tracking-tight text-foreground">
          <span className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </span>
          <span className="mx-1.5 font-normal text-muted-foreground/60">
            ·
          </span>
          <span className="font-semibold">{title}</span>
        </h1>
        {detail ? <span className="sr-only">{detail}</span> : null}
        {showFeedShortcut ? (
          <Link
            href="/feed"
            className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Feed
          </Link>
        ) : null}
      </header>
    );
  }

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
