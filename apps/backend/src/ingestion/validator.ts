import type { ParsedQuestion } from './question-parser.js';

export type ValidationStatus = 'VALID' | 'WARNING' | 'INVALID';

export interface ValidationResult {
  status: ValidationStatus;
  question: ParsedQuestion;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  field?: string;
}

export function validateQuestion(question: ParsedQuestion): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (question.questionNumber === null || question.questionNumber <= 0) {
    issues.push({
      severity: 'error',
      code: 'MISSING_QUESTION_NUMBER',
      message: 'Question number is missing or invalid',
      field: 'questionNumber',
    });
  }

  if (!question.gateYear || question.gateYear < 2000 || question.gateYear > 2030) {
    issues.push({
      severity: 'error',
      code: 'INVALID_GATE_YEAR',
      message: `Invalid GATE year: ${question.gateYear}`,
      field: 'gateYear',
    });
  }

  if (!question.paperNumber) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_PAPER_NUMBER',
      message: 'Paper number is not specified',
      field: 'paperNumber',
    });
  }

  if (!question.body || question.body.trim().length < 10) {
    issues.push({
      severity: 'error',
      code: 'INVALID_BODY',
      message: 'Question body is missing or too short',
      field: 'body',
    });
  }

  if (question.type === 'unknown') {
    issues.push({
      severity: 'error',
      code: 'UNKNOWN_QUESTION_TYPE',
      message: 'Could not determine question type (MCQ/MSQ/NAT)',
      field: 'type',
    });
  }

  if (question.type === 'mcq' || question.type === 'msq') {
    if (question.options.length < 2) {
      issues.push({
        severity: 'error',
        code: 'INSUFFICIENT_OPTIONS',
        message: `${question.type.toUpperCase()} requires at least 2 options, found ${question.options.length}`,
        field: 'options',
      });
    }
    const hasValidOptions = question.options.every(o => o.body && o.body.trim().length > 0);
    if (!hasValidOptions) {
      issues.push({
        severity: 'error',
        code: 'EMPTY_OPTION_BODY',
        message: 'One or more options have empty body text',
        field: 'options',
      });
    }
    if (question.type === 'mcq') {
      const correctCount = question.options.filter(o => o.isCorrect === true).length;
      if (correctCount !== 1 && question.answer) {
        issues.push({
          severity: 'warning',
          code: 'MCQ_INCORRECT_COUNT',
          message: `MCQ should have exactly 1 correct option, answer indicates ${question.answer.value}`,
          field: 'options',
        });
      }
    }
    if (question.type === 'msq') {
      const correctCount = question.options.filter(o => o.isCorrect === true).length;
      if (correctCount < 1 && question.answer) {
        issues.push({
          severity: 'warning',
          code: 'MSQ_NO_CORRECT',
          message: 'MSQ should have at least 1 correct option',
          field: 'options',
        });
      }
    }
  }

  if (question.type === 'nat') {
    if (question.answer && question.answer.type === 'numeric' && question.answer.value === null) {
      issues.push({
        severity: 'warning',
        code: 'NAT_NO_NUMERIC_ANSWER',
        message: 'NAT question has no numeric answer value',
        field: 'answer',
      });
    }
  }

  if (question.marks === null) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_MARKS',
      message: 'Marks not specified, will default to 1',
      field: 'marks',
    });
  } else if (question.marks < 0 || question.marks > 100) {
    issues.push({
      severity: 'error',
      code: 'INVALID_MARKS',
      message: `Marks value ${question.marks} is out of valid range (0-100)`,
      field: 'marks',
    });
  }

  if (question.negativeMarks !== null && (question.negativeMarks < 0 || question.negativeMarks > 100)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_NEGATIVE_MARKS',
      message: `Negative marks value ${question.negativeMarks} is out of valid range (0-100)`,
      field: 'negativeMarks',
    });
  }

  for (const warning of question.warnings) {
    issues.push({
      severity: 'warning',
      code: 'PARSER_WARNING',
      message: warning,
    });
  }

  const hasErrors = issues.some(i => i.severity === 'error');
  const hasWarnings = issues.some(i => i.severity === 'warning');

  let status: ValidationStatus;
  if (hasErrors) status = 'INVALID';
  else if (hasWarnings) status = 'WARNING';
  else status = 'VALID';

  return { status, question, issues };
}

export function validateQuestions(questions: ParsedQuestion[]): ValidationResult[] {
  return questions.map(validateQuestion);
}

export function filterByStatus(results: ValidationResult[], status: ValidationStatus): ParsedQuestion[] {
  return results
    .filter(r => r.status === status)
    .map(r => r.question);
}

export function getValidationSummary(results: ValidationResult[]): {
  valid: number;
  warning: number;
  invalid: number;
  totalIssues: number;
} {
  let valid = 0;
  let warning = 0;
  let invalid = 0;
  let totalIssues = 0;

  for (const r of results) {
    totalIssues += r.issues.length;
    switch (r.status) {
      case 'VALID': valid++; break;
      case 'WARNING': warning++; break;
      case 'INVALID': invalid++; break;
    }
  }

  return { valid, warning, invalid, totalIssues };
}