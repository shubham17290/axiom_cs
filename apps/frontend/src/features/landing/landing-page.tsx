"use client";
// PG-STD-02 — PREPForge landing: forge-accent hero + subject preview grid (guest sees counts only).
import Link from "next/link";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { subjectsService } from "@/services";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, SkeletonList } from "@/components/ui/states";
import { BRAND } from "@/lib/brand";

const FEATURES = [
  { title: "Real previous-year papers", desc: "GATE CS &amp; IT PYQs, organised by subject, topic, year and difficulty." },
  { title: "Instant grading", desc: "MCQ, MSQ and NAT answers graded against the canonical answer key the moment you submit." },
  { title: "Weak-topic radar", desc: "Accuracy per subject and topic, so your next study session is always targeted." },
  { title: "Bookmarks &amp; mistakes", desc: "Star questions for later review and replay your mistakes in a dedicated session." },
];

export function LandingPage() {
  const { data, loading, error, retry } = useApi(() => subjectsService.list(), []);
  const { status } = useAuth();

  return (
    <div className="mx-auto max-w-content px-4 py-10 sm:px-8">
      <section className="relative overflow-hidden rounded-lg2 border border-line bg-gradient-to-br from-[color:var(--accent-soft)] via-surface to-[color:var(--primary-soft)] p-8 text-center sm:p-14">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--accent-ink)]">
            PREPForge · GATE CS &amp; IT
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-ink sm:text-4xl">
            Forge your GATE CS &amp; IT prep with real previous-year questions
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Practice subject-wise and year-wise PYQs with instant grading, detailed explanations,
            and weak-topic insights that tell you exactly what to study next.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/practice" tabIndex={status === "authenticated" ? 0 : -1}>
              <Button size="lg">Start practicing →</Button>
            </Link>
            <Link href="/register" tabIndex={status === "authenticated" ? 0 : -1}>
              <Button size="lg" variant="secondary">Create free account</Button>
            </Link>
          </div>
          {status === "guest" && (
            <p className="mt-3 text-xs text-muted">
              Trial runs in the browser — create an account to save progress.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="features-heading" className="mt-14">
        <h2 id="features-heading" className="text-center text-xl font-semibold">Why PREPForge</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="h-full">
              <h3 className="font-semibold text-[color:var(--accent)]">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted">{feature.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="subjects-heading" className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="subjects-heading" className="text-xl font-semibold">GATE CS &amp; IT subjects</h2>
          {status === "authenticated" && (
            <Link href="/subjects" className="text-sm font-medium text-[color:var(--accent)] hover:underline">
              Browse all subjects →
            </Link>
          )}
        </div>
        {loading ? (
          <div className="mt-4"><SkeletonList rows={3} /></div>
        ) : error ? (
          <div className="mt-4"><ErrorState error={error} retry={retry} /></div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.items ?? []).map((subject) => (
              <Card key={subject.id} className="flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold">{subject.name}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {subject.questions_count} questions · {subject.topics_count} topics
                  </p>
                </div>
                {status === "authenticated" ? (
                  <Link
                    href={`/subjects/${subject.id}/topics`}
                    className="mt-4 inline-flex touch-target items-center font-medium text-[color:var(--accent)]"
                  >
                    Browse topics →
                  </Link>
                ) : (
                  <p className="mt-4 text-xs text-muted">Log in to practice this subject</p>
                )}
              </Card>
            ))}
            {(data?.items ?? []).length === 0 && (
              <p className="col-span-full rounded-md2 border border-dashed border-line p-8 text-center text-muted">
                No subjects published yet — check back soon.
              </p>
            )}
          </div>
        )}
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-center text-xs text-muted">
        {BRAND.name} · GATE CS &amp; IT PYQ Practice Platform · Built for aspirants, by aspirants.
      </footer>
    </div>
  );
}