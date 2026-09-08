import { PrismaClient } from "@prisma/client";
import { pbkdf2Sync, randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const SUBJECT_ID = "00000000-0000-4000-8000-000000000001";
const TOPIC_ALGO_ID = "00000000-0000-4000-8000-000000000011";
const TOPIC_DS_ID = "00000000-0000-4000-8000-000000000012";
const MCQ_ID = "00000000-0000-4000-8000-000000000101";
const MSQ_ID = "00000000-0000-4000-8000-000000000102";
const NAT_ID = "00000000-0000-4000-8000-000000000103";
const DEV_USER_ID = "00000000-0000-4000-8000-0000000000aa";
const DEV_USER_EMAIL = "dev-seed@gate-pyq.local";

// PBKDF2 hashing compatible with core/utils/crypto (config defaults: 310000 iters, sha512, 64-byte key).
function hashPassword(password: string): string {
  const iterations = 310_000;
  const keyLength = 64;
  const salt = randomBytes(16).toString("hex");
  const derived = pbkdf2Sync(password, salt, iterations, keyLength, "sha512");
  return `pbkdf2$${iterations}$${salt}$${derived.toString("hex")}`;
}

async function main(): Promise<void> {
  // RBAC reference data (Phase 4 §5): roles must exist for the dev user + registrations.
  for (const { code, name } of [
    { code: "student", name: "Student" },
    { code: "moderator", name: "Moderator" },
    { code: "admin", name: "Administrator" },
  ]) {
    await prisma.role.upsert({ where: { code }, update: {}, create: { code, name, isActive: true } });
  }

  // Self-contained creator: find-or-create a fixed development user as question author/reviewer.
  const studentRole = await prisma.role.findUniqueOrThrow({ where: { code: "student" } });
  const creator = await prisma.user.upsert({
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

  const subject = await prisma.subject.upsert({
    where: { id: SUBJECT_ID },
    update: { code: "DEV-CS", name: "Development Computer Science", isActive: true, deletedAt: null },
    create: { id: SUBJECT_ID, code: "DEV-CS", name: "Development Computer Science", sortOrder: 0 },
  });
  const algorithmTopic = await prisma.topic.upsert({
    where: { id: TOPIC_ALGO_ID },
    update: { subjectId: subject.id, name: "Algorithms (Development)", isActive: true, sortOrder: 0 },
    create: { id: TOPIC_ALGO_ID, subjectId: subject.id, name: "Algorithms (Development)", sortOrder: 0 },
  });
  const dataStructuresTopic = await prisma.topic.upsert({
    where: { id: TOPIC_DS_ID },
    update: { subjectId: subject.id, name: "Data Structures (Development)", isActive: true, sortOrder: 1 },
    create: { id: TOPIC_DS_ID, subjectId: subject.id, name: "Data Structures (Development)", sortOrder: 1 },
  });

  const mcqType = await prisma.questionType.upsert({ where: { code: "mcq" }, update: {}, create: { code: "mcq", name: "Multiple Choice (Single Correct)", hasOptions: true, hasNumeric: false, supportsMultiple: false } });
  const msqType = await prisma.questionType.upsert({ where: { code: "msq" }, update: {}, create: { code: "msq", name: "Multiple Select (Multiple Correct)", hasOptions: true, hasNumeric: false, supportsMultiple: true } });
  const natType = await prisma.questionType.upsert({ where: { code: "nat" }, update: {}, create: { code: "nat", name: "Numerical Answer", hasOptions: false, hasNumeric: true, supportsMultiple: false } });
  for (const mode of ["subject", "topic", "year", "difficulty", "mistake", "custom"]) {
    await prisma.practiceMode.upsert({ where: { code: mode }, update: {}, create: { code: mode, name: mode[0].toUpperCase() + mode.slice(1) } });
  }
  const questions = [
    { id: MCQ_ID, typeId: mcqType.id, topicId: algorithmTopic.id, code: "MCQ", body: "[DEV DATA] Which traversal visits a binary search tree in sorted order?", explanation: "In-order traversal visits left subtree, root, then right subtree.", marks: 1, negativeMarks: 0.25, options: [{ id: "00000000-0000-4000-8000-000000000201", body: "In-order", isCorrect: true, sortOrder: 0 }, { id: "00000000-0000-4000-8000-000000000202", body: "Pre-order", isCorrect: false, sortOrder: 1 }, { id: "00000000-0000-4000-8000-000000000203", body: "Post-order", isCorrect: false, sortOrder: 2 }] },
    { id: MSQ_ID, typeId: msqType.id, topicId: dataStructuresTopic.id, code: "MSQ", body: "[DEV DATA] Which structures can implement a FIFO queue?", explanation: "A linked list or a pair of stacks can implement a queue.", marks: 2, negativeMarks: 0, options: [{ id: "00000000-0000-4000-8000-000000000211", body: "Linked list", isCorrect: true, sortOrder: 0 }, { id: "00000000-0000-4000-8000-000000000212", body: "Two stacks", isCorrect: true, sortOrder: 1 }, { id: "00000000-0000-4000-8000-000000000213", body: "A single immutable integer", isCorrect: false, sortOrder: 2 }] },
    { id: NAT_ID, typeId: natType.id, topicId: algorithmTopic.id, code: "NAT", body: "[DEV DATA] What is the value of 2^3?", explanation: "Two multiplied by itself three times is eight.", marks: 1, negativeMarks: 0, numericValue: 8 },
  ];

  for (const item of questions) {
    const question = await prisma.question.upsert({
      where: { id: item.id },
      update: { questionTypeId: item.typeId, subjectId: subject.id, topicId: item.topicId, body: item.body, explanation: item.explanation, marks: item.marks, negativeMarks: item.negativeMarks, difficulty: "easy", status: "published", version: 1, gateYear: 2099, createdById: creator.id, reviewedById: creator.id },
      create: { id: item.id, questionTypeId: item.typeId, subjectId: subject.id, topicId: item.topicId, body: item.body, explanation: item.explanation, marks: item.marks, negativeMarks: item.negativeMarks, difficulty: "easy", status: "published", version: 1, gateYear: 2099, createdById: creator.id, reviewedById: creator.id },
    });

    if ("options" in item) {
      for (const option of item.options) {
        await prisma.questionOption.upsert({ where: { id: option.id }, update: { questionId: question.id, body: option.body, isCorrect: option.isCorrect, sortOrder: option.sortOrder }, create: { ...option, questionId: question.id } });
      }
    }
    if ("numericValue" in item) {
      await prisma.questionNumericAnswer.upsert({
        where: { id: "00000000-0000-4000-8000-000000000301" },
        update: { questionId: question.id, numericValue: item.numericValue, toleranceAbs: 0, toleranceRel: 0 },
        create: { id: "00000000-0000-4000-8000-000000000301", questionId: question.id, numericValue: item.numericValue, toleranceAbs: 0, toleranceRel: 0 },
      });
    }

    const typeCode = item.code.toLowerCase();
    const snapshot = {
      question_id: question.id, type_code: typeCode, body: item.body, explanation: item.explanation,
      marks: Number(item.marks), negative_marks: Number(item.negativeMarks), difficulty: "easy", gate_year: 2099,
      subject_id: subject.id, topic_id: item.topicId,
      options: "options" in item ? item.options.map(({ id, body, isCorrect }) => ({ id, body, is_correct: isCorrect })) : [],
      numeric_answers: "numericValue" in item ? [{ numeric_value: String(item.numericValue), tolerance_abs: "0", tolerance_rel: "0", unit: null }] : [],
    };
    await prisma.questionVersion.upsert({
      where: { questionId_version: { questionId: question.id, version: 1 } },
      update: { snapshot, createdById: creator.id, reason: "Development seed" },
      create: { questionId: question.id, version: 1, snapshot, createdById: creator.id, reason: "Development seed" },
    });
  }

  console.log("Development seed complete: 1 subject, 2 topics, 1 MCQ, 1 MSQ, 1 NAT.");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
