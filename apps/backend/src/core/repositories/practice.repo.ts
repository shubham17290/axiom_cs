// PHASE 8 — Practice sessions + attempts data access (Phase 3 §6.15–6.17)
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface SessionConfig {
  mode: string;
  filters: {
    subject_id?: string;
    topic_id?: string;
    year?: number;
    difficulty?: string;
    question_types?: string[];
  };
  question_count: number;
  pool: string[] | null;
}

export async function ensurePracticeMode(code: string): Promise<{ id: string; code: string }> {
  const existing = await prisma.practiceMode.findUnique({ where: { code } });
  if (existing) return existing;
  return prisma.practiceMode.create({
    data: { code, name: code.charAt(0).toUpperCase() + code.slice(1) },
  });
}

export async function createSession(input: {
  userId: string;
  modeId: string;
  config: SessionConfig;
  timed: boolean;
  totalQuestions: number;
}) {
  return prisma.practiceSession.create({
    data: {
      userId: input.userId,
      modeId: input.modeId,
      config: input.config as unknown as Prisma.InputJsonValue,
      timed: input.timed,
      totalQuestions: input.totalQuestions,
      status: "in_progress",
    },
  });
}

const SESSION_SELECT = {
  id: true,
  userId: true,
  status: true,
  timed: true,
  totalQuestions: true,
  score: true,
  startedAt: true,
  endedAt: true,
  abandonedAt: true,
  config: true,
  mode: { select: { id: true, code: true, name: true } },
} satisfies Prisma.PracticeSessionSelect;

export type SessionRow = Prisma.PracticeSessionGetPayload<{ select: typeof SESSION_SELECT }>;

export async function findSessionById(id: string): Promise<SessionRow | null> {
  return prisma.practiceSession.findUnique({ where: { id }, select: SESSION_SELECT });
}

export function parseSessionConfig(raw: unknown): SessionConfig {
  // Config is a server-written jsonb payload (Phase 3 §6.16); defensive parse.
  const value = raw as Partial<SessionConfig> | null;
  if (!value || typeof value !== "object") {
    throw new Error("SESSION_CONFIG_CORRUPT");
  }
  return {
    mode: String(value.mode ?? "custom"),
    filters: value.filters ?? {},
    question_count: Number(value.question_count ?? 0),
    pool: Array.isArray(value.pool) ? (value.pool as string[]) : null,
  };
}

export async function savePool(sessionId: string, config: SessionConfig): Promise<void> {
  await prisma.practiceSession.update({
    where: { id: sessionId },
    data: { config: config as unknown as Prisma.InputJsonValue },
  });
}

export async function completeSession(sessionId: string, score: number): Promise<void> {
  await prisma.practiceSession.update({
    where: { id: sessionId },
    data: { status: "completed", endedAt: new Date(), score },
  });
}

export async function abandonSession(sessionId: string): Promise<void> {
  await prisma.practiceSession.update({
    where: { id: sessionId },
    data: { status: "abandoned", abandonedAt: new Date(), endedAt: new Date() },
  });
}

// ─── Attempts ────────────────────────────────────────────────────────────────

export interface AttemptUpsertInput {
  sessionId: string;
  userId: string;
  questionVersionId: string;
  selectedAnswers: unknown;
  isCorrect: boolean;
  marks: number;
  timeTakenSeconds: number;
}

export async function findAttempt(sessionId: string, questionVersionId: string) {
  return prisma.attempt.findFirst({ where: { sessionId, questionVersionId } });
}

/**
 * Idempotent attempt upsert (Phase 4 §8.2): one row per (session, question version).
 * Phase 3 has no DB unique constraint on this pair, so uniqueness is enforced
 * inside a transaction here; concurrent duplicate submits serialize on the row read.
 * `sequence` = order of first answer within the session (Phase 3 §6.17).
 */
export async function upsertAttempt(input: AttemptUpsertInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.attempt.findFirst({
      where: { sessionId: input.sessionId, questionVersionId: input.questionVersionId },
    });
    if (existing) {
      return tx.attempt.update({
        where: { id: existing.id },
        data: {
          selectedAnswers: input.selectedAnswers as Prisma.InputJsonValue,
          isCorrect: input.isCorrect,
          marks: input.marks,
          timeTakenSeconds: input.timeTakenSeconds,
          answeredAt: new Date(),
          responseVersion: { increment: 1 },
        },
      });
    }
    const priorCount = await tx.attempt.count({ where: { sessionId: input.sessionId } });
    return tx.attempt.create({
      data: {
        sessionId: input.sessionId,
        userId: input.userId,
        questionVersionId: input.questionVersionId,
        sequence: priorCount + 1,
        selectedAnswers: input.selectedAnswers as Prisma.InputJsonValue,
        isCorrect: input.isCorrect,
        marks: input.marks,
        timeTakenSeconds: input.timeTakenSeconds,
      },
    });
  });
}

export async function listAttemptsForSession(sessionId: string) {
  return prisma.attempt.findMany({
    where: { sessionId },
    orderBy: [{ answeredAt: "asc" }],
    select: {
      id: true,
      questionVersionId: true,
      selectedAnswers: true,
      isCorrect: true,
      marks: true,
      timeTakenSeconds: true,
      answeredAt: true,
    },
  });
}

export async function attemptsForSessionWithTopics(sessionId: string) {
  return prisma.attempt.findMany({
    where: { sessionId },
    orderBy: [{ answeredAt: "asc" }],
    select: {
      questionVersionId: true,
      isCorrect: true,
      marks: true,
      timeTakenSeconds: true,
      questionVersion: {
        select: {
          snapshot: true,
          question: { select: { id: true, topicId: true, explanation: true } },
        },
      },
    },
  });
}

/** Max marks over the session pool using the marks from the question versions used by attempts. */
export async function sumMarksForQuestionVersions(versionIds: string[]): Promise<number> {
  if (versionIds.length === 0) return 0;
  const rows = await prisma.questionVersion.findMany({
    where: { id: { in: versionIds } },
    select: { snapshot: true },
  });
  return rows.reduce((total, row) => {
    const snap = row.snapshot as { marks?: number } | null;
    return total + (snap?.marks ?? 0);
  }, 0);
}

/** Max marks over the session pool using current authored marks per question (fallback). */
export async function sumMarksForQuestions(questionIds: string[]): Promise<number> {
  if (questionIds.length === 0) return 0;
  const rows = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { marks: true },
  });
  return rows.reduce((total, row) => total + Number(row.marks), 0);
}
