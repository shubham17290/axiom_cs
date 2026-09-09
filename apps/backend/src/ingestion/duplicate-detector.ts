import type { ParsedQuestion } from './question-parser.js';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingIdentity?: {
    examYear: number;
    paperNumber: string | null;
    shift: string | null;
    questionNumber: number | null;
  };
}

export function buildSourceIdentity(
  examYear: number,
  paperNumber: string | null,
  shift: string | null,
  questionNumber: number | null
): string {
  const paper = paperNumber ?? 'NA';
  const shiftStr = shift ?? 'NA';
  const qNum = questionNumber ?? 0;
  return `${examYear}|${paper}|${shiftStr}|${qNum}`;
}

export function checkDuplicateInBatch(
  question: ParsedQuestion,
  previousQuestions: ParsedQuestion[]
): DuplicateCheckResult {
  const identity = buildSourceIdentity(
    question.gateYear ?? 0,
    question.paperNumber,
    question.shift,
    question.questionNumber
  );

  for (const prev of previousQuestions) {
    const prevIdentity = buildSourceIdentity(
      prev.gateYear ?? 0,
      prev.paperNumber,
      prev.shift,
      prev.questionNumber
    );
    if (prevIdentity === identity) {
      return {
        isDuplicate: true,
        existingIdentity: {
          examYear: prev.gateYear ?? 0,
          paperNumber: prev.paperNumber,
          shift: prev.shift,
          questionNumber: prev.questionNumber,
        },
      };
    }
  }

  return { isDuplicate: false };
}

export function checkAllDuplicates(questions: ParsedQuestion[]): Map<string, number[]> {
  const identityMap = new Map<string, number[]>();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q.questionNumber === null || q.gateYear === null) continue;

    const identity = buildSourceIdentity(
      q.gateYear,
      q.paperNumber,
      q.shift,
      q.questionNumber
    );

    if (!identityMap.has(identity)) {
      identityMap.set(identity, []);
    }
    identityMap.get(identity)!.push(i);
  }

  const duplicates = new Map<string, number[]>();
  for (const [identity, indices] of identityMap) {
    if (indices.length > 1) {
      duplicates.set(identity, indices);
    }
  }

  return duplicates;
}