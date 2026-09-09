// PHASE 8 — Practice session lifecycle service (Phase 4 §3.2.5–3.2.8, §7, §8)
import { config } from "../config/env";
import { errors } from "../errors";
import { gradeAnswer, QuestionSnapshot } from "../grading/grading.service";
import { prisma } from "../repositories/prisma";
import * as questionsRepo from "../repositories/questions.repo";
import * as practiceRepo from "../repositories/practice.repo";
import type { SessionConfig, SessionRow } from "../repositories/practice.repo";
import { findSubjectById, findTopicById } from "../repositories/taxonomy.repo";
import { writeAuditEntry } from "../repositories/analytics.repo";

const MAX_POOL_CANDIDATES = 500;

export interface CreateSessionInput {
  mode: string;
  filters: {
    subject_id?: string;
    topic_id?: string;
    year?: number;
    difficulty?: string;
    question_types?: string[];
  };
  timed: boolean;
  questionCount: number;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadOwnedSession(sessionId: string, userId: string): Promise<SessionRow> {
  const session = await practiceRepo.findSessionById(sessionId);
  if (!session) throw errors.notFound("SESSION_NOT_FOUND", "Practice session not found.");
  if (session.userId !== userId) throw errors.notOwner();
  return session;
}

/** 24h resume window (Phase 2): in_progress sessions older than the window are abandoned. */
async function sweepAbandoned(session: SessionRow): Promise<SessionRow> {
  if (session.status === "in_progress" && Date.now() - session.startedAt.getTime() > config.practice.abandonWindowMs) {
    await practiceRepo.abandonSession(session.id);
    return { ...session, status: "abandoned", abandonedAt: new Date(), endedAt: new Date() };
  }
  return session;
}

function assertLive(session: SessionRow): void {
  if (session.status !== "in_progress") {
    throw errors.conflict("CONFLICT_SESSION_NOT_LIVE", "This session is no longer in progress.");
  }
}

export async function createSession(userId: string, input: CreateSessionInput) {
  // Business validation (Phase 4 §6): active subject/topic, matching pool required.
  const filters = input.filters;
  const activeKeys = Object.values(filters).filter((value) => value !== undefined).length;
  if (activeKeys > 2) {
    throw errors.validation([
      { field: "filters", code: "VALIDATION_TOO_MANY_FILTERS", message: "At most 2 filter keys may be active." },
    ]);
  }
  if (filters.subject_id) {
    const subject = await findSubjectById(filters.subject_id);
    if (!subject) {
      throw errors.validation([
        { field: "filters.subject_id", code: "VALIDATION_UNKNOWN_SUBJECT", message: "Subject does not exist or is inactive." },
      ]);
    }
  }
  if (filters.topic_id) {
    const topic = await findTopicById(filters.topic_id);
    if (!topic || !topic.isActive) {
      throw errors.validation([
        { field: "filters.topic_id", code: "VALIDATION_UNKNOWN_TOPIC", message: "Topic does not exist or is inactive." },
      ]);
    }
  }

  const questionFilters: questionsRepo.QuestionFilters = {
    subjectId: filters.subject_id,
    topicId: filters.topic_id,
    year: filters.year,
    difficulty: filters.difficulty,
  };
  if (filters.question_types && filters.question_types.length === 1) {
    questionFilters.typeCode = filters.question_types[0];
  }

  const available = await questionsRepo.countPublishedQuestions(questionFilters);
  if (available < 1) throw errors.noMatchingQuestions();

  const total = Math.min(available, input.questionCount);
  const mode = await practiceRepo.ensurePracticeMode(input.mode);

  const sessionConfig: SessionConfig = {
    mode: input.mode,
    filters: {
      ...(filters.subject_id ? { subject_id: filters.subject_id } : {}),
      ...(filters.topic_id ? { topic_id: filters.topic_id } : {}),
      ...(filters.year !== undefined ? { year: filters.year } : {}),
      ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
      ...(filters.question_types ? { question_types: filters.question_types } : {}),
    },
    question_count: input.questionCount,
    pool: null,
  };

  const session = await practiceRepo.createSession({
    userId,
    modeId: mode.id,
    config: sessionConfig,
    timed: input.timed,
    totalQuestions: total,
  });

  return {
    id: session.id,
    mode: input.mode,
    timed: session.timed,
    total_questions: session.totalQuestions,
    status: session.status,
    started_at: session.startedAt.toISOString(),
  };
}

export async function startSession(sessionId: string, userId: string) {
  let session = await loadOwnedSession(sessionId, userId);
  session = await sweepAbandoned(session);
  assertLive(session);

  const parsed = practiceRepo.parseSessionConfig(session.config);
  if (!parsed.pool || parsed.pool.length === 0) {
    const poolFilters: questionsRepo.QuestionFilters = {
      subjectId: parsed.filters.subject_id,
      topicId: parsed.filters.topic_id,
      year: parsed.filters.year,
      difficulty: parsed.filters.difficulty,
    };
    // Mirror createSession: honor a single requested question type when building the pool,
    // otherwise startSession could draw questions of the wrong type into an MSQ/NAT session.
    if (parsed.filters.question_types && parsed.filters.question_types.length === 1) {
      poolFilters.typeCode = parsed.filters.question_types[0];
    }
    const candidates = await questionsRepo.poolCandidateIds(poolFilters, MAX_POOL_CANDIDATES);
    parsed.pool = shuffle(candidates).slice(0, session.totalQuestions);
    await practiceRepo.savePool(session.id, parsed);
  }

  return buildSessionState(session.id);
}

export async function getSessionState(sessionId: string, userId: string) {
  let session = await loadOwnedSession(sessionId, userId);
  session = await sweepAbandoned(session);
  return buildSessionState(session.id);
}

interface PoolQuestion {
  id: string;
  body: string;
  type_code: string;
  marks: number;
  difficulty: string;
  gate_year: number;
  options: Array<{ id: string; body: string }>;
}

/** Restore view: pool + saved attempts; correct answers/explanations never exposed here (FR-EVAL-04). */
async function buildSessionState(sessionId: string) {
  const session = await practiceRepo.findSessionById(sessionId);
  if (!session) throw errors.notFound("SESSION_NOT_FOUND", "Practice session not found.");
  const parsed = practiceRepo.parseSessionConfig(session.config);

  const poolIds = parsed.pool ?? [];
  const attempts = await practiceRepo.listAttemptsForSession(session.id);
  const versionIds = attempts.map((attempt) => attempt.questionVersionId);
  const versions = versionIds.length
    ? await prisma.questionVersion.findMany({
        where: { id: { in: versionIds } },
        select: { id: true, snapshot: true },
      })
    : [];
  const questionIdByAttempt = new Map<string, string>();
  for (const version of versions) {
    const snapshot = version.snapshot as Partial<QuestionSnapshot>;
    if (snapshot && typeof snapshot.question_id === "string") {
      questionIdByAttempt.set(version.id, snapshot.question_id);
    }
  }

  const questions: PoolQuestion[] = [];
  for (const questionId of poolIds) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        body: true,
        marks: true,
        difficulty: true,
        gateYear: true,
        questionType: { select: { code: true } },
        options: { orderBy: { sortOrder: "asc" }, select: { id: true, body: true } },
      },
    });
    if (!question) continue;
    questions.push({
      id: question.id,
      body: question.body,
      type_code: question.questionType.code,
      marks: Number(question.marks),
      difficulty: question.difficulty,
      gate_year: question.gateYear,
      options: question.options.map((option) => ({ id: option.id, body: option.body })),
    });
  }

  return {
    session_id: session.id,
    mode: session.mode.code,
    timed: session.timed,
    status: session.status,
    started_at: session.startedAt.toISOString(),
    total_questions: session.totalQuestions,
    questions,
    attempts: attempts.map((attempt) => ({
      attempt_id: attempt.id,
      question_id: questionIdByAttempt.get(attempt.questionVersionId) ?? null,
      is_correct: attempt.isCorrect,
      marks: Number(attempt.marks),
      time_taken_seconds: attempt.timeTakenSeconds,
    })),
  };
}

export async function recordAttempt(
  sessionId: string,
  userId: string,
  body: { question_id: string; answer: Record<string, unknown>; time_taken_seconds: number },
) {
  let session = await loadOwnedSession(sessionId, userId);
  session = await sweepAbandoned(session);
  assertLive(session);

  const parsed = practiceRepo.parseSessionConfig(session.config);
  const pool = parsed.pool ?? [];
  if (!pool.includes(body.question_id)) throw errors.questionNotInSession();

  const version = await questionsRepo.currentVersionForQuestion(body.question_id);
  if (!version) {
    throw errors.validation([
      { field: "question_id", code: "VALIDATION_QUESTION_UNAVAILABLE", message: "Question has no gradable version." },
    ]);
  }
  const snapshot = version.snapshot as unknown as QuestionSnapshot;

  const grade = gradeAnswer(snapshot, body.answer as never);

  const existing = await practiceRepo.findAttempt(session.id, version.id);
  const saved = await practiceRepo.upsertAttempt({
    sessionId: session.id,
    userId,
    questionVersionId: version.id,
    selectedAnswers: body.answer,
    isCorrect: grade.isCorrect,
    marks: grade.marksAwarded,
    timeTakenSeconds: body.time_taken_seconds,
  });

  return {
    created: existing === null,
    payload: {
      attempt_id: saved.id,
      question_id: body.question_id,
      is_correct: grade.isCorrect,
      marks: Number(saved.marks),
      time_taken_seconds: saved.timeTakenSeconds,
    },
  };
}

export interface ResultPayload {
  session_id: string;
  mode: string;
  timed: boolean;
  status: string;
  started_at: string;
  ended_at: string | null;
  score: { total_marks: number; max_marks: number; negative_marks: number };
  summary: { attempted: number; correct: number; incorrect: number; skipped: number };
  per_topic: Array<{ topic_id: string | null; attempted: number; correct: number }>;
  mistakes: string[];
  explanations: Array<{ question_id: string; explanation: string }>;
}

export async function completeSession(sessionId: string, userId: string): Promise<ResultPayload> {
  let session = await loadOwnedSession(sessionId, userId);
  session = await sweepAbandoned(session);
  assertLive(session);

  // OD-06: unanswered questions are "skipped" — they simply have no attempt row and score nothing.
  const rows = await practiceRepo.attemptsForSessionWithTopics(session.id);
  const score = rows.reduce((total, row) => total + Number(row.marks), 0);
  await practiceRepo.completeSession(session.id, score);

  await writeAuditEntry({
    actorId: userId,
    action: "session.complete",
    entityType: "practice_sessions",
    entityId: session.id,
    after: { status: "completed", score },
  });

  const refreshed = await practiceRepo.findSessionById(session.id);
  return buildResult(refreshed ?? session, rows);
}

export async function getResult(sessionId: string, userId: string): Promise<ResultPayload> {
  let session = await loadOwnedSession(sessionId, userId);
  session = await sweepAbandoned(session);
  if (session.status !== "completed") {
    throw errors.conflict("CONFLICT_RESULT_NOT_READY", "Result is only available after the session is completed.");
  }
  const rows = await practiceRepo.attemptsForSessionWithTopics(session.id);
  return buildResult(session, rows);
}

async function buildResult(session: SessionRow, rows: Awaited<ReturnType<typeof practiceRepo.attemptsForSessionWithTopics>>): Promise<ResultPayload> {

  const correct = rows.filter((row) => row.isCorrect).length;
  const negative = rows.reduce((total, row) => total + (Number(row.marks) < 0 ? Math.abs(Number(row.marks)) : 0), 0);
  const versionIds = rows.map((row) => row.questionVersionId);
  const maxMarks = await practiceRepo.sumMarksForQuestionVersions(versionIds);

  const perTopic = new Map<string | null, { attempted: number; correct: number }>();
  const mistakes: string[] = [];
  const explanations: Array<{ question_id: string; explanation: string }> = [];
  for (const row of rows) {
    const topicKey = row.questionVersion.question.topicId;
    const entry = perTopic.get(topicKey) ?? { attempted: 0, correct: 0 };
    entry.attempted += 1;
    if (row.isCorrect) entry.correct += 1;
    perTopic.set(topicKey, entry);

    const questionId = row.questionVersion.question.id;
    if (!row.isCorrect) mistakes.push(questionId);
    if (row.questionVersion.question.explanation) {
      explanations.push({ question_id: questionId, explanation: row.questionVersion.question.explanation });
    }
  }

  return {
    session_id: session.id,
    mode: session.mode.code,
    timed: session.timed,
    status: session.status,
    started_at: session.startedAt.toISOString(),
    ended_at: session.endedAt ? session.endedAt.toISOString() : null,
    score: {
      total_marks: Number(session.score ?? 0),
      max_marks: Math.round(maxMarks * 100) / 100,
      negative_marks: Math.round(negative * 100) / 100,
    },
    summary: {
      attempted: rows.length,
      correct,
      incorrect: rows.length - correct,
      skipped: Math.max(0, session.totalQuestions - rows.length),
    },
    per_topic: [...perTopic.entries()].map(([topic_id, stats]) => ({ topic_id, ...stats })),
    mistakes,
    explanations,
  };
}
