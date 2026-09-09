import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomBytes, pbkdf2Sync } from "node:crypto";

const prisma = new PrismaClient();

const DEV_USER_ID = "00000000-0000-4000-8000-0000000000aa";
const DEV_USER_EMAIL = "dev-seed@gate-pyq.local";
const SUBJECT_ID = "00000000-0000-4000-8000-000000000001";

function hashPassword(password: string): string {
  const iterations = 310_000;
  const keyLength = 64;
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(password, salt, iterations, keyLength, "sha512");
  return `pbkdf2$${iterations}$${salt}$${derived.toString("hex")}`;
}

async function ensureDevUser() {
  const studentRole = await prisma.role.upsert({
    where: { code: "student" },
    update: {},
    create: { code: "student", name: "Student", isActive: true },
  });
  return prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: { roleId: studentRole.id, status: "active", deletedAt: null },
    create: {
      id: DEV_USER_ID,
      email: DEV_USER_EMAIL,
      passwordHash: hashPassword("dev-passw0rd-1"),
      roleId: studentRole.id,
      fullName: "Development Seeder",
      status: "active",
    },
  });
}

async function ensureDevSubject() {
  return prisma.subject.upsert({
    where: { id: SUBJECT_ID },
    update: { code: "DEV-CS", name: "Development Computer Science", isActive: true, deletedAt: null },
    create: { id: SUBJECT_ID, code: "DEV-CS", name: "Development Computer Science", sortOrder: 0 },
  });
}

async function cleanup() {
  await prisma.attempt.deleteMany({});
  await prisma.bookmark.deleteMany({});
  await prisma.practiceSession.deleteMany({});
  await prisma.questionVersion.deleteMany({});
  await prisma.questionNumericAnswer.deleteMany({});
  await prisma.questionOption.deleteMany({});
  await prisma.$queryRaw`DELETE FROM "questions" WHERE "gate_year" >= 2090`;
  await prisma.$queryRaw`DELETE FROM "question_sources" WHERE "exam_year" >= 2090`;
  await prisma.topic.deleteMany({ where: { subjectId: SUBJECT_ID } });
  await prisma.subject.deleteMany({ where: { id: SUBJECT_ID } });
  await prisma.user.deleteMany({ where: { id: DEV_USER_ID } });
  const role = await prisma.role.findUnique({ where: { code: "student" } });
  if (role) {
    const userCount = await prisma.user.count({ where: { roleId: role.id } });
    if (userCount === 0) await prisma.role.delete({ where: { code: "student" } });
  }
}

describe("Question Number and GATE Source Identity", () => {
  beforeAll(async () => {
    await ensureDevUser();
    await ensureDevSubject();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("Question number persists on QuestionSource", async () => {
    const source = await prisma.questionSource.create({
      data: {
        name: "TEST-GATE-CS-2091-P1",
        examYear: 2091,
        paperNumber: "1",
        shift: "Morning",
        questionNumber: 5,
        isActive: true,
      },
    });
    expect(source.questionNumber).toBe(5);
    expect(source.examYear).toBe(2091);
    expect(source.paperNumber).toBe("1");
    expect(source.shift).toBe("Morning");
  });

  it("Different question numbers are accepted for the same year", async () => {
    const source1 = await prisma.questionSource.create({
      data: { name: "TEST-Q1-2091", examYear: 2091, paperNumber: "1", shift: "Morning", questionNumber: 1, isActive: true },
    });
    const source2 = await prisma.questionSource.create({
      data: { name: "TEST-Q2-2091", examYear: 2091, paperNumber: "1", shift: "Morning", questionNumber: 2, isActive: true },
    });
    expect(source1.questionNumber).not.toBe(source2.questionNumber);
  });

  it("Different paper/shift identities are accepted", async () => {
    const source1 = await prisma.questionSource.create({
      data: { name: "TEST-CS-P1-2092", examYear: 2092, paperNumber: "1", shift: "Morning", questionNumber: 1, isActive: true },
    });
    const source2 = await prisma.questionSource.create({
      data: { name: "TEST-CS-P2-2092", examYear: 2092, paperNumber: "2", shift: "Afternoon", questionNumber: 1, isActive: true },
    });
    expect(source1.paperNumber).not.toBe(source2.paperNumber);
    expect(source1.shift).not.toBe(source2.shift);
  });
});

describe("Duplicate Prevention", () => {
  beforeAll(async () => {
    await ensureDevUser();
    await ensureDevSubject();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("Same GATE source identity is rejected", async () => {
    await prisma.questionSource.create({
      data: { name: "TEST-DUP-Q1-2092", examYear: 2092, paperNumber: "1", shift: "Morning", questionNumber: 1, isActive: true },
    });
    await expect(
      prisma.questionSource.create({
        data: { name: "TEST-DUP-Q2-2092", examYear: 2092, paperNumber: "1", shift: "Morning", questionNumber: 1, isActive: true },
      })
    ).rejects.toThrow();
  });

  it("Different question numbers are accepted", async () => {
    const source1 = await prisma.questionSource.create({
      data: { name: "TEST-Q1-2093", examYear: 2093, paperNumber: "1", shift: "Morning", questionNumber: 1, isActive: true },
    });
    const source2 = await prisma.questionSource.create({
      data: { name: "TEST-Q2-2093", examYear: 2093, paperNumber: "1", shift: "Morning", questionNumber: 2, isActive: true },
    });
    expect(source1.id).not.toBe(source2.id);
  });
});

describe("Historical Marks", () => {
  beforeAll(async () => {
    await ensureDevUser();
    await ensureDevSubject();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("Version 1 marks are preserved after Version 2 is published", async () => {
    const question = await prisma.question.create({
      data: {
        questionTypeId: (await prisma.questionType.findUniqueOrThrow({ where: { code: "mcq" } })).id,
        subjectId: SUBJECT_ID,
        body: "[TEST] Historical marks question",
        explanation: "Test explanation",
        marks: 1,
        negativeMarks: 0.33,
        difficulty: "easy",
        status: "published",
        gateYear: 2091,
        createdById: DEV_USER_ID,
        reviewedById: DEV_USER_ID,
        options: { create: [{ body: "Option A", isCorrect: true, sortOrder: 0 }, { body: "Option B", isCorrect: false, sortOrder: 1 }] },
        numericAnswers: { create: [] },
      },
    });

    const version1 = await prisma.questionVersion.create({
      data: {
        questionId: question.id,
        version: 1,
        snapshot: {
          question_id: question.id,
          type_code: "mcq",
          body: question.body,
          explanation: question.explanation,
          marks: 1,
          negative_marks: 0.33,
          difficulty: "easy",
          gate_year: 2091,
          subject_id: SUBJECT_ID,
          topic_id: null,
          question_number: null,
          source_id: null,
          options: [{ id: "opt1", body: "Option A", is_correct: true }, { id: "opt2", body: "Option B", is_correct: false }],
          numeric_answers: [],
        },
        reason: "Initial publish",
        createdById: DEV_USER_ID,
      },
    });

    await prisma.question.update({
      where: { id: question.id },
      data: { version: 2, marks: 2, negativeMarks: 0.66 },
    });

    const version2 = await prisma.questionVersion.create({
      data: {
        questionId: question.id,
        version: 2,
        snapshot: {
          question_id: question.id,
          type_code: "mcq",
          body: question.body,
          explanation: question.explanation,
          marks: 2,
          negative_marks: 0.66,
          difficulty: "easy",
          gate_year: 2091,
          subject_id: SUBJECT_ID,
          topic_id: null,
          question_number: null,
          source_id: null,
          options: [{ id: "opt1", body: "Option A", is_correct: true }, { id: "opt2", body: "Option B", is_correct: false }],
          numeric_answers: [],
        },
        reason: "Updated marks",
        createdById: DEV_USER_ID,
      },
    });

    const v1Snapshot = version1.snapshot as { marks: number; negative_marks: number };
    const v2Snapshot = version2.snapshot as { marks: number; negative_marks: number };

    expect(v1Snapshot.marks).toBe(1);
    expect(v1Snapshot.negative_marks).toBe(0.33);
    expect(v2Snapshot.marks).toBe(2);
    expect(v2Snapshot.negative_marks).toBe(0.66);
  });
});
