"use client";
// PG-STD-SUBJ / PG-STD-TPLC — Subject + topic browsers (Phase 5 §4.4).
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/hooks/use-api";
import { subjectsService } from "@/services";
import { Card } from "@/components/ui/card";
import { Badge, difficultyTone } from "@/components/ui/card";
import { Breadcrumb } from "@/components/layout/navigation";
import { ErrorState, SkeletonList, EmptyState } from "@/components/ui/states";
import { formatAccuracy } from "@/utils/format";

export function SubjectsPage() {
  const { data, loading, error, retry } = useApi(() => subjectsService.list(), []);

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-8">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Subjects" }]} />
      <h1 className="mb-6 mt-3 text-2xl font-bold">Browse subjects</h1>

      {loading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState error={error} retry={retry} />
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState icon="📚" message="No subjects published yet." cta="Back to dashboard" onCta={() => history.back()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.items ?? []).map((subject) => (
            <Link key={subject.id} href={`/subjects/${subject.id}/topics`} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-med">
                <h2 className="font-semibold text-primary">{subject.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {subject.questions_count} questions · {subject.topics_count} topics
                </p>
                {subject.accuracy !== null && subject.accuracy !== undefined && (
                  <p className="mt-2 text-sm">
                    Your accuracy:{" "}
                    <span className={`font-semibold ${subject.accuracy >= 0.6 ? "text-success" : subject.accuracy >= 0.45 ? "text-warning" : "text-danger"}`}>
                      {formatAccuracy(subject.accuracy)}
                    </span>
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopicsPage() {
  const params = useParams<{ subjectId: string }>();
  const [previewTopicId, setPreviewTopicId] = useState<string | null>(null);
  const preview = useApi(
    () => (previewTopicId ? subjectsService.topicQuestions(params.subjectId, previewTopicId) : Promise.resolve(null)),
    [params.subjectId, previewTopicId],
  );
  const { data, loading, error, retry } = useApi(() => subjectsService.topics(params.subjectId), []);

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-8">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Subjects", href: "/subjects" }, { label: "Topics" }]} />
      <h1 className="mb-6 mt-3 text-2xl font-bold">Topics</h1>

      {loading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState error={error} retry={retry} />
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState message="No questions published for this subject yet." />
      ) : (
        <ul className="flex flex-col gap-3">
          {(data?.items ?? []).map((topic) => (
            <li key={topic.id}>
              <Card className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{topic.name}</h2>
                  <p className="text-sm text-muted">{topic.questions_count} questions</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewTopicId(topic.id === previewTopicId ? null : topic.id)}
                    aria-expanded={topic.id === previewTopicId}
                    className="touch-target rounded-md2 border border-line px-3 text-sm font-medium hover:border-primary"
                  >
                    Preview
                  </button>
                  <Link
                    href={`/practice?mode=topic&topic_id=${topic.id}&subject_id=${params.subjectId}`}
                    className="touch-target inline-flex items-center rounded-md2 bg-primary px-4 text-sm font-medium text-white"
                  >
                    Practice
                  </Link>
                </div>
              </Card>
              {topic.id === previewTopicId && (
                <Card className="mt-2 border-dashed">
                  {preview.loading ? (
                    <SkeletonList rows={2} />
                  ) : preview.error ? (
                    <ErrorState error={preview.error} retry={preview.retry} />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {(preview.data?.items ?? []).slice(0, 3).map((question) => (
                        <li key={question.id} className="rounded-md2 bg-bg p-3">
                          <p className="line-clamp-2 text-sm">{question.body}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge tone="info">{question.type_code.toUpperCase()}</Badge>
                            <Badge tone="neutral">GATE {question.gate_year}</Badge>
                            <Badge tone={difficultyTone(question.difficulty)}>{question.difficulty}</Badge>
                            <Badge tone="neutral">{question.marks} mark{question.marks === 1 ? "" : "s"}</Badge>
                          </div>
                        </li>
                      ))}
                      {(preview.data?.items ?? []).length === 0 && (
                        <li className="py-2 text-center text-sm text-muted">No published questions in this topic yet.</li>
                      )}
                    </ul>
                  )}
                </Card>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
