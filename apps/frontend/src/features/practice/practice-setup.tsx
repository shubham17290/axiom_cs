"use client";
// PG-STD-PRAC-SETUP — Configure and launch a practice session using the existing practice API.
// Deep links supported: /practice?mode=topic&topic_id=…&subject_id=… (topics page, dashboard weak topics).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { practiceService, subjectsService } from "@/services";
import type { Paginated, TopicSummary } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/states";
import { Breadcrumb } from "@/components/layout/navigation";
import { useToast } from "@/components/ui/overlay";

type Mode = "topic" | "subject" | "mistake";

const MODES: Array<{ value: Mode; title: string; desc: string; icon: string }> = [
  { value: "topic", title: "Topic focus", desc: "Drill one topic across all its questions.", icon: "🎯" },
  { value: "subject", title: "Subject drill", desc: "Mixed-topic session for a whole subject.", icon: "📚" },
  { value: "mistake", title: "Mistake review", desc: "Re-attempt questions from earlier misses.", icon: "🛠️" },
];

const COUNT_PRESETS = [5, 10, 15, 20];

export function PracticeSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useToast();

  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get("mode") === "mistake" ? "mistake" : "topic",
  );
  const [subjectId, setSubjectId] = useState<string>(searchParams.get("subject_id") ?? "");
  const [topicId, setTopicId] = useState<string>(searchParams.get("topic_id") ?? "");
  const [questionCount, setQuestionCount] = useState(5);
  const [timed, setTimed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<ApiError | null>(null);

  // Subject + (dependent) topic resources — same public APIs used by the subject pages.
  const subjects = useApi(() => subjectsService.list(), []);
  const topics = useApi<Paginated<TopicSummary> | null>(
    () => (subjectId ? subjectsService.topics(subjectId) : Promise.resolve(null)),
    [subjectId],
  );

  // Resolve a topic-only deep link (e.g. dashboard weak-topics) to its owning subject.
  const resolvedRef = useRef(false);
  useEffect(() => {
    const subjectsData = subjects.data;
    if (!topicId || subjectId || !subjectsData || resolvedRef.current) return;
    void (async () => {
      for (const subject of subjectsData.items ?? []) {
        try {
          const { items } = await subjectsService.topics(subject.id);
          if ((items ?? []).some((topic) => topic.id === topicId)) {
            setSubjectId(subject.id);
            break;
          }
        } catch {
          // Best-effort prefill: keep scanning unreadable subjects.
        }
      }
      resolvedRef.current = true;
    })();
  }, [topicId, subjectId, subjects.data]);

  const selectedSubject = useMemo(
    () => (subjects.data?.items ?? []).find((subject) => subject.id === subjectId) ?? null,
    [subjects.data, subjectId],
  );

  const topicOptions = topics.data?.items ?? [];
  // A topic is only "active" if it belongs to the currently selected subject.
  const activeTopicId = (topicOptions ?? []).some((topic) => topic.id === topicId) ? topicId : "";
  const selectedTopic = topicOptions.find((topic) => topic.id === activeTopicId) ?? null;
  const needsTopic = mode === "topic";

  const validationMessage = useMemo(() => {
    if (creating) return null;
    if (needsTopic) return subjectId && !activeTopicId ? "Pick a topic to focus this session." : null;
    return subjectId ? null : "Pick a subject to continue.";
  }, [creating, needsTopic, subjectId, activeTopicId]);

  async function handleStart() {
    if (creating) return;
    setCreateError(null);
    setCreating(true);
    try {
      const filters: { subject_id?: string; topic_id?: string } = {};
      if (subjectId) filters.subject_id = subjectId;
      if (mode === "topic" && activeTopicId) filters.topic_id = activeTopicId;
      const session = await practiceService.create({
        mode,
        filters,
        timed,
        question_count: questionCount,
      });
      notify(`Session ready — ${session.total_questions} question(s) queued.`, "success");
      router.push(`/practice/${session.id}`);
    } catch (error) {
      setCreateError(
        error instanceof ApiError ? error : new ApiError(500, "UNKNOWN", "Could not start the session."),
      );
    } finally {
      setCreating(false);
    }
  }

  const subjectsEmpty = (subjects.data?.items ?? []).length === 0;

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-8">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Practice" }]} />

      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Start a practice session</h1>
          <p className="mt-1 text-sm text-muted">
            Configure a focused session and get graded instantly against the GATE answer key.
          </p>
        </div>
        <span aria-hidden="true" className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent-ink)]">
          MCQ · MSQ · NAT
        </span>
      </header>
{subjects.loading ? (
        <div className="mt-6"><SkeletonList rows={5} /></div>
      ) : subjects.error ? (
        <div className="mt-6"><ErrorState error={subjects.error} retry={subjects.retry} /></div>
      ) : subjectsEmpty ? (
        <div className="mt-6">
          <EmptyState
            icon="📚"
            message="No subjects are published yet. Check back soon to start practicing."
            cta="Back to dashboard"
            onCta={() => router.push("/dashboard")}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-6">
            {/* Step 1 — session mode */}
            <Card>
              <StepTitle step="1" title="Choose your format" />
              <div className="grid gap-3 sm:grid-cols-3">
                {MODES.map((choice) => {
                  const active = mode === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => setMode(choice.value)}
                      aria-pressed={active}
                      className={`touch-target rounded-md2 border p-4 text-left transition-colors ${
                        active
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                          : "border-line bg-surface hover:border-primary"
                      }`}
                    >
                      <span className="text-xl" aria-hidden="true">{choice.icon}</span>
                      <span className={`mt-2 block text-sm font-semibold ${active ? "text-[color:var(--accent-ink)]" : "text-ink"}`}>
                        {choice.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{choice.desc}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Step 2 — subject + topic */}
            <Card>
              <StepTitle step="2" title={needsTopic ? "Pick subject & topic" : "Pick subject"} />
              <p className="-mt-1 mb-3 text-xs text-muted">
                {needsTopic
                  ? "Select a subject, then a topic for a focused session."
                  : "Choose the subject you want to drill."}
              </p>
              <label className="block text-sm font-medium">
                Subject
                <select
                  value={subjectId}
                  onChange={(event) => {
                    setSubjectId(event.target.value);
                    setTopicId("");
                  }}
                  className="mt-1 h-11 w-full rounded-md2 border border-line bg-surface px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Select a subject —</option>
                  {(subjects.data?.items ?? []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} · {subject.questions_count} questions
                    </option>
                  ))}
                </select>
              </label>
{subjectId && (
                <div className="mt-4">
                  {topics.loading ? (
                    <SkeletonList rows={3} />
                  ) : topics.error ? (
                    <ErrorState error={topics.error} retry={topics.retry} />
                  ) : (topicOptions ?? []).length === 0 ? (
                    <p className="rounded-md2 border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                      No published questions in this subject yet.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-2">
                      {topicOptions.map((topic) => {
                        const active = topic.id === activeTopicId;
                        return (
                          <li key={topic.id}>
                            <button
                              type="button"
                              onClick={() => setTopicId(active ? "" : topic.id)}
                              aria-pressed={active}
                              className={`touch-target flex w-full items-center justify-between gap-3 rounded-md2 border px-4 py-2.5 text-left ${
                                active
                                  ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                                  : "border-line bg-surface hover:border-primary"
                              }`}
                            >
                              <span className="text-sm font-medium">{topic.name}</span>
                              <span className="shrink-0 text-xs text-muted">{topic.questions_count} questions</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </Card>

            {/* Step 3 — session settings */}
            <Card>
              <StepTitle step="3" title="Session settings" />
              <div className="grid gap-4 sm:grid-cols-2">
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Question count</legend>
                  <div className="flex flex-wrap gap-2">
                    {COUNT_PRESETS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setQuestionCount(count)}
                        aria-pressed={questionCount === count}
                        className={`touch-target rounded-md2 border px-3 text-sm font-medium ${
                          questionCount === count
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-ink)]"
                            : "border-line bg-surface text-muted hover:border-primary"
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Includes the latest available questions, up to this count.
                  </p>
                </fieldset>

                <label className="flex items-start gap-3 text-sm font-medium">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={timed}
                    onClick={() => setTimed((value) => !value)}
                    className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      timed ? "bg-[color:var(--accent)]" : "bg-line"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`size-4 rounded-full bg-white shadow transition-transform ${timed ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                  <span>
                    Timed session
                    <span className="block text-xs font-normal text-muted">
                      Marks the session as timed, like the real exam.
                    </span>
                  </span>
                </label>
              </div>
            </Card>
          </div>
{/* Launch / summary column */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Card className="border-[color:var(--accent)]/40 bg-gradient-to-br from-surface to-[color:var(--accent-soft)]/60">
              <CardTitle>Session summary</CardTitle>
              <dl className="space-y-3 text-sm">
                <SummaryRow label="Format" value={modeTitle(mode)} />
                <SummaryRow label="Subject" value={selectedSubject?.name ?? "—"} />
                <SummaryRow label="Topic" value={mode === "topic" ? (selectedTopic?.name ?? "—") : "Whole subject"} />
                <SummaryRow label="Questions" value={`Up to ${questionCount}`} />
                <SummaryRow label="Timing" value={timed ? "Timed" : "Untimed"} />
                <SummaryRow label="Grading" value="Instant · official key" />
              </dl>

              <div className="mt-5">
                <Button size="lg" loading={creating} disabled={!!validationMessage} onClick={() => void handleStart()}>
                  {creating ? "Creating session…" : "Start practice →"}
                </Button>
                {validationMessage && (
                  <p role="note" className="mt-2 text-xs font-medium text-warning">
                    {validationMessage}
                  </p>
                )}
                {createError && (
                  <p role="alert" className="mt-2 rounded-md2 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                    {createError.message}
                  </p>
                )}
              </div>

              <ul className="mt-5 space-y-1.5 border-t border-line pt-4 text-xs text-muted">
                <li>· Bookmark questions during the session</li>
                <li>· Wrong answers feed your mistake review</li>
                <li>· Unanswered questions are skipped, never penalised</li>
              </ul>
            </Card>

            <Link
              href="/subjects"
              className="touch-target mt-3 flex items-center justify-center rounded-md2 border border-line bg-surface text-sm font-medium text-muted hover:border-primary"
            >
              Browse subjects instead →
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

function StepTitle({ step, title }: { step: string; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-full bg-[color:var(--accent)] text-xs font-bold text-white"
      >
        {step}
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}

function modeTitle(mode: Mode): string {
  return MODES.find((choice) => choice.value === mode)?.title ?? mode;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-semibold text-ink">{value}</dd>
    </div>
  );
}