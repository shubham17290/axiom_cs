"use client";
// PG-STD-DSH — PREPForge dashboard: greeting, stat cards, subject bars, weak topics, quick CTAs.
import Link from "next/link";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { analyticsService, subjectsService } from "@/services";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { ErrorState, SkeletonList } from "@/components/ui/states";
import { formatAccuracy, formatSeconds } from "@/utils/format";
import { BRAND } from "@/lib/brand";

export function DashboardPage() {
  const { user } = useAuth();
  const summary = useApi(() => analyticsService.dashboardSummary(), []);
  const subjects = useApi(() => analyticsService.subjects(1), []);
  const topics = useApi(() => analyticsService.topics(1), []);
  const weak = useApi(() => analyticsService.dashboardWeak(5), []);

  const loading = summary.loading || subjects.loading || weak.loading;
  const error = summary.error ?? subjects.error ?? weak.error;

  if (loading) return <div className="p-6"><SkeletonList rows={5} /></div>;
  if (error) return <div className="p-6"><ErrorState error={error} retry={summary.retry} /></div>;

  const overview = summary.data;
  const lastSession = overview?.last_session;

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--accent)]">
            {BRAND.name}
          </p>
          <h1 className="text-2xl font-bold">Hi {(user?.full_name ?? "there").split(" ")[0]} 👋</h1>
          <p className="text-sm text-muted">Here is your preparation at a glance.</p>
        </div>
        {lastSession && lastSession.status === "in_progress" && (
          <Link
            href={`/practice/${lastSession.id}`}
            className="touch-target inline-flex items-center rounded-md2 bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--accent-strong)]"
          >
            Resume last session →
          </Link>
        )}
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" role="list">
        <StatCard label="Accuracy" value={formatAccuracy(overview?.accuracy)} emphasis />
        <StatCard label="Attempts" value={overview?.total_attempts ?? 0} />
        <StatCard label="Avg time / Q" value={formatSeconds(overview?.avg_time_s)} />
        <StatCard label="Streak" value={`${overview?.streak_days ?? 0}d`} sub={overview && overview.streak_days > 0 ? "Keep it going!" : undefined} />
      </div>

      {/* Quick actions — keep the demo flow one click away (PG-STD-01). */}
      <nav aria-label="Quick actions" className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/practice"
          className="touch-target inline-flex items-center gap-1.5 rounded-md2 bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--accent-strong)]"
        >
          ⚡ Start practice
        </Link>
        <Link
          href="/subjects"
          className="touch-target inline-flex items-center gap-1.5 rounded-md2 border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-primary"
        >
          📚 Browse subjects
        </Link>
        <Link
          href="/mistakes"
          className="touch-target inline-flex items-center gap-1.5 rounded-md2 border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-primary"
        >
          ✨ Review mistakes
        </Link>
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Subject performance</CardTitle>
          <BarList
            items={(subjects.data?.items ?? []).map((subject) => ({
              id: subject.subject_id,
              label: subject.subject_name ?? "Subject",
              accuracy: subject.accuracy,
              attempts: subject.attempts,
              href: `/subjects/${subject.subject_id}/topics`,
            }))}
          />
          {(subjects.data?.items ?? []).length === 0 && (
            <EmptyHint text="Attempt a few questions to see subject-wise strength." href="/practice" cta="Start practice" />
          )}
        </Card>

        <Card className="border-warning/40 bg-warning-soft/40">
          <CardTitle>⚠ Weak topics</CardTitle>
          <p className="-mt-2 mb-3 text-xs text-muted">Accuracy below 45% with at least 5 attempts.</p>
          <ul className="flex flex-col gap-2">
            {(weak.data ?? []).map((topic) => (
              <li key={topic.topic_id}>
                <Link
                  href={`/practice?mode=topic&topic_id=${topic.topic_id}`}
                  className="flex touch-target items-center justify-between rounded-md2 border border-warning/30 bg-surface px-4 py-2.5 hover:border-primary"
                >
                  <span className="font-medium">{topic.topic_name ?? "Topic"}</span>
                  <span className="text-sm font-semibold text-danger">{formatAccuracy(topic.accuracy)}</span>
                </Link>
              </li>
            ))}
            {(weak.data ?? []).length === 0 && (
              <li className="rounded-md2 border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-muted">
                No weak topics detected — great work!
              </li>
            )}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Topic leaderboard</CardTitle>
        <ul className="divide-y divide-line">
          {(topics.data?.items ?? []).slice(0, 8).map((topic) => (
            <li key={topic.topic_id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate">
                {topic.topic_name ?? topic.topic_id}
                <span className="ml-2 text-xs text-muted">{topic.attempts} attempts</span>
              </span>
              <span className={`text-sm font-semibold ${topic.accuracy >= 0.6 ? "text-success" : topic.accuracy >= 0.45 ? "text-warning" : "text-danger"}`}>
                {formatAccuracy(topic.accuracy)}
              </span>
            </li>
          ))}
          {(topics.data?.items ?? []).length === 0 && (
            <li className="py-4 text-center text-sm text-muted">No topic data yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

export function BarList({
  items,
}: {
  items: Array<{ id: string; label: string; accuracy: number; attempts: number; href?: string }>;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const percent = Math.round(item.accuracy * 100);
        return (
          <li key={item.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              {item.href ? (
                <Link href={item.href} className="font-medium hover:text-[color:var(--accent)]">{item.label}</Link>
              ) : (
                <span className="font-medium">{item.label}</span>
              )}
              <span aria-hidden="true" className="text-xs text-muted">{percent}% · {item.attempts}Q</span>
            </div>
            <div
              role="img"
              aria-label={`${item.label}: ${percent}% accuracy over ${item.attempts} questions`}
              className="h-2 overflow-hidden rounded-full bg-line"
            >
              <div
                className={`h-full rounded-full ${percent >= 60 ? "bg-success" : percent >= 45 ? "bg-warning" : "bg-danger"}`}
                style={{ width: `${Math.max(percent, item.attempts > 0 ? 2 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyHint({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <p className="rounded-md2 border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
      {text}{" "}
      <Link href={href} className="font-medium text-[color:var(--accent)]">{cta}</Link>
    </p>
  );
}