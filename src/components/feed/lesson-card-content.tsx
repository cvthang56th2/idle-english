import type { LessonCard } from "@/types/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const typeLabels: Record<LessonCard["type"], string> = {
  vocabulary: "Vocabulary",
  phrase: "Phrase",
  grammar_correction: "Grammar fix",
  slang: "Slang",
  developer_english: "Dev English",
  pronunciation: "Pronunciation",
};

export function LessonCardHeader({
  card,
  className,
}: {
  card: LessonCard;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-center gap-2 px-1", className)}>
      <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-wide">
        {typeLabels[card.type]}
      </Badge>
      <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] capitalize">
        {card.level}
      </Badge>
      {card.tags.slice(0, 3).map((tag) => (
        <span
          key={tag}
          className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
        >
          #{tag}
        </span>
      ))}
    </header>
  );
}

export function LessonCardBody({
  card,
  className,
}: {
  card: LessonCard;
  className?: string;
}) {
  const c = card.content;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-5 px-1", className)}>
      <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        {card.title}
      </h1>

      {"wrong" in c && "correct" in c ? (
        <div className="grid gap-3">
          <div
            className={cn(
              "rounded-3xl border border-red-500/25 bg-red-500/10 px-5 py-4 text-lg leading-relaxed",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
              Avoid
            </p>
            <p className="mt-2 text-xl font-medium">{c.wrong}</p>
          </div>
          <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 text-lg leading-relaxed">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Say
            </p>
            <p className="mt-2 text-xl font-medium">{c.correct}</p>
          </div>
        </div>
      ) : null}

      {"term" in c ? (
        <div className="rounded-3xl border border-border bg-card/60 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Word
          </p>
          <p className="mt-2 text-3xl font-semibold">{c.term}</p>
          {c.hint ? (
            <p className="mt-2 text-base text-muted-foreground">{c.hint}</p>
          ) : null}
        </div>
      ) : null}

      {"word" in c ? (
        <div className="rounded-3xl border border-border bg-card/60 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Sound
          </p>
          <p className="mt-2 text-3xl font-semibold">{c.word}</p>
          {c.note ? (
            <p className="mt-2 text-base text-muted-foreground">{c.note}</p>
          ) : null}
        </div>
      ) : null}

      {"phrase" in c && !("wrong" in c) ? (
        <div className="rounded-3xl border border-border bg-card/60 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Phrase
          </p>
          <p className="mt-2 text-2xl font-semibold leading-snug">{c.phrase}</p>
          {c.short ? (
            <p className="mt-2 text-sm text-primary">{c.short}</p>
          ) : null}
          {c.meaning ? (
            <p className="mt-2 text-base text-muted-foreground">{c.meaning}</p>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby={`explain-${card.id}`}>
        <h2 id={`explain-${card.id}`} className="sr-only">
          Explanation
        </h2>
        <p className="text-lg leading-relaxed text-muted-foreground">{card.explanation}</p>
      </section>

      <div className="rounded-3xl border border-dashed border-primary/35 bg-primary/5 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Example
        </p>
        <p className="mt-2 text-xl font-medium leading-relaxed">{card.example}</p>
      </div>
    </div>
  );
}
