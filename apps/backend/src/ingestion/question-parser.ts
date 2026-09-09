export interface ParsedQuestion {
  questionNumber: number | null;
  rawText: string;
  body: string;
  type: 'mcq' | 'msq' | 'nat' | 'unknown';
  options: ParsedOption[];
  answer: ParsedAnswer | null;
  marks: number | null;
  negativeMarks: number | null;
  gateYear: number | null;
  paperNumber: string | null;
  shift: string | null;
  sourceFile: string;
  warnings: string[];
}

export interface ParsedOption {
  label: string;
  body: string;
  isCorrect: boolean | null;
}

export interface ParsedAnswer {
  type: 'option' | 'options' | 'numeric' | 'numeric_range';
  value: string | string[] | number | null;
  tolerance?: number;
  rawText: string;
}

export interface MarksRange {
  start: number;
  end: number;
  marks: number;
}

export interface QuestionBoundary {
  startIndex: number;
  endIndex: number;
  questionNumber: number;
  rawText: string;
}

const QUESTION_PATTERNS = [
  /^Q\s*\.\s*(\d{1,2})\s*(?:–|:|\s)/m,
  /^Q\s*(\d{1,2})\s*(?:–|:|\s)/m,
  /^Q\s*\.\s*(\d{1,2})$/m,
  /^Q\s*(\d{1,2})$/m,
];

const HEADER_PATTERNS = [
  /^Computer Science/i,
  /^Organizing Institute/i,
  /^Page \d+ of \d+/i,
  /^GATE \d{4}/i,
  /^CS\s+Page/i,
  /^–\s*Q\.\d+/,
  /^\d+ of \d+ --/,
  /^--\s+\d+\s+of\s+\d+\s+--$/,
  /^Q\.\d+\s*[–-]\s*Q\.\d+\s+Carry/i,
];

const OPTION_PATTERNS = [
  /\(\s*([A-D])\s*\)\s*(.+)$/m,
  /\[\s*([A-D])\s*\]\s*(.+)$/m,
  /^([A-D])\.\s*(.+)$/m,
  /^([A-D])\s+(.+)$/m,
];

const ANSWER_KEY_PATTERNS = [
  /answer\s*[:=]\s*([A-D])/i,
  /correct\s*(?:answer|option)\s*[:=]\s*([A-D])/i,
  /key\s*[:=]\s*([A-D])/i,
];

const MARKS_PATTERNS = [
  /carry\s+(?:one|two)\s+mark[s]?\s+(?:each)?/i,
  /\((\d+)\s*marks?\)/i,
  /marks?\s*[:=]\s*(\d+(?:\.\d+)?)/i,
];

const NEGATIVE_MARKS_PATTERNS = [
  /negative\s+marks?\s*[:=]\s*(\d+(?:\.\d+)?)/i,
  /penalty\s*[:=]\s*(\d+(?:\.\d+)?)/i,
];

const MSQ_INDICATORS = [
  /one\s+or\s+more\s+(?:of\s+the\s+following\s+)?(?:option|answer)/i,
  /multiple\s+(?:correct|select)/i,
  /select\s+(?:all\s+that\s+apply|multiple)/i,
];

const NAT_INDICATORS = [
  /answer\s*(?:is|:)\s*\d+/i,
  /numerical\s+answer/i,
  /fill\s+in\s+the\s+blank/i,
  /_{3,}/,
  /the value of .* is\s*\./i,
  /^is\s+\.$/i,
  /the number of .* is\s*\./i,
];

function detectQuestionType(text: string): 'mcq' | 'msq' | 'nat' | 'unknown' {
  const lowerText = text.toLowerCase();

  for (const indicator of NAT_INDICATORS) {
    if (indicator.test(lowerText)) return 'nat';
  }

  for (const indicator of MSQ_INDICATORS) {
    if (indicator.test(lowerText)) return 'msq';
  }

  const optionCount = (text.match(/\([A-D]\)/g) || []).length;
  if (optionCount >= 2) return 'mcq';

  return 'unknown';
}

function extractOptions(text: string): ParsedOption[] {
  const options: ParsedOption[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    for (const pattern of OPTION_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        const label = match[1];
        const body = match[2].trim();
        if (body.length > 0) {
          options.push({ label, body, isCorrect: null });
        }
        break;
      }
    }
  }

  if (options.length < 2) {
    const altPatterns = [
      /\(([A-D])\)\s*([^()\n]{5,})/g,
      /([A-D])\)\s*([^()\n]{5,})/g,
    ];
    for (const pattern of altPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[2] && match[2].trim().length > 0) {
          const label = match[1];
          const body = match[2].trim();
          if (!options.some(o => o.label === label)) {
            options.push({ label, body, isCorrect: null });
          }
        }
      }
    }
  }

  return options;
}

function extractAnswer(text: string, type: ParsedQuestion['type']): ParsedAnswer | null {
  if (type === 'nat') {
    const numMatch = text.match(/answer\s*(?:is|:)\s*([\d.\-eE]+)/i);
    if (numMatch) {
      return {
        type: 'numeric',
        value: parseFloat(numMatch[1]),
        rawText: numMatch[0],
      };
    }
    const blankMatch = text.match(/_{3,}/);
    if (blankMatch) {
      return {
        type: 'numeric',
        value: null,
        rawText: '[blank]',
      };
    }
  }

  if (type === 'msq') {
    const answers: string[] = [];
    for (const pattern of ANSWER_KEY_PATTERNS) {
      const matches = text.matchAll(new RegExp(pattern.source, 'gi'));
      for (const match of matches) {
        if (match[1] && !answers.includes(match[1].toUpperCase())) {
          answers.push(match[1].toUpperCase());
        }
      }
    }
    if (answers.length > 0) {
      return { type: 'options', value: answers, rawText: answers.join(', ') };
    }
  }

  if (type === 'mcq') {
    for (const pattern of ANSWER_KEY_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'option',
          value: match[1].toUpperCase(),
          rawText: match[0],
        };
      }
    }
  }

  return null;
}

function extractMarks(text: string, questionNumber: number, marksRanges: MarksRange[]): { marks: number | null; negativeMarks: number | null } {
  let marks: number | null = null;
  let negativeMarks: number | null = null;

  const oneMarkMatch = text.match(/carry\s+one\s+mark/i);
  const twoMarkMatch = text.match(/carry\s+two\s+marks?/i);

  if (oneMarkMatch) marks = 1;
  else if (twoMarkMatch) marks = 2;

  for (const pattern of MARKS_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      if (!isNaN(val)) marks = val;
      break;
    }
  }

  if (marks === null && marksRanges.length > 0) {
    for (const range of marksRanges) {
      if (questionNumber >= range.start && questionNumber <= range.end) {
        marks = range.marks;
        break;
      }
    }
  }

  for (const pattern of NEGATIVE_MARKS_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      negativeMarks = parseFloat(match[1]);
      break;
    }
  }

  return { marks, negativeMarks };
}

function cleanBodyText(text: string, questionNumber: number): string {
  let body = text;

  body = body.replace(new RegExp(`^Q\\s*\\.?\\s*${questionNumber}\\s*`, 'i'), '');
  body = body.replace(/^\d+\.\s*/, '');
  body = body.replace(/^Q\s*\d+\s*/i, '');

  const optionStart = body.search(/\([A-D]\)/i);
  if (optionStart !== -1) {
    body = body.substring(0, optionStart);
  }

  const answerStart = Math.min(
    ...[body.toLowerCase().indexOf('answer'),
     body.toLowerCase().indexOf('correct'),
     body.toLowerCase().indexOf('key')]
      .filter(i => i !== -1)
  );

  if (answerStart !== -1 && answerStart > 50) {
    body = body.substring(0, answerStart);
  }

  return body.trim();
}

function isHeaderLine(line: string): boolean {
  for (const pattern of HEADER_PATTERNS) {
    if (pattern.test(line)) return true;
  }
  return false;
}

export function detectQuestionBoundaries(text: string): QuestionBoundary[] {
  const boundaries: QuestionBoundary[] = [];
  const lines = text.split('\n');
  let currentStart = -1;
  let currentNumber = -1;
  let currentText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isHeaderLine(line)) {
      continue;
    }

    let matched = false;
    let qNum = -1;

    for (const pattern of QUESTION_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        qNum = parseInt(match[1], 10);
        if (!isNaN(qNum) && qNum > 0 && qNum <= 65) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      if (currentStart !== -1 && currentText.trim().length > 20) {
        boundaries.push({
          startIndex: currentStart,
          endIndex: i - 1,
          questionNumber: currentNumber,
          rawText: currentText.trim(),
        });
      }
      currentStart = i;
      currentNumber = qNum;
      currentText = line + '\n';
    } else {
      if (currentStart !== -1) {
        currentText += line + '\n';
      }
    }
  }

  if (currentStart !== -1 && currentText.trim().length > 20) {
    boundaries.push({
      startIndex: currentStart,
      endIndex: lines.length - 1,
      questionNumber: currentNumber,
      rawText: currentText.trim(),
    });
  }

  return boundaries;
}

export function parseQuestion(
  boundary: QuestionBoundary,
  sourceFile: string,
  defaultYear: number | null,
  defaultPaper: string | null,
  defaultShift: string | null,
  marksRanges: MarksRange[] = []
): ParsedQuestion {
  const warnings: string[] = [];
  const text = boundary.rawText;

  const type = detectQuestionType(text);
  if (type === 'unknown') {
    warnings.push('Could not determine question type (MCQ/MSQ/NAT)');
  }

  const options = extractOptions(text);
  if ((type === 'mcq' || type === 'msq') && options.length < 2) {
    warnings.push(`Expected at least 2 options for ${type.toUpperCase()}, found ${options.length}`);
  }

  const answer = extractAnswer(text, type);
  if (!answer && type !== 'unknown') {
    warnings.push('No answer found in extracted text');
  }

  const { marks, negativeMarks } = extractMarks(text, boundary.questionNumber ?? 0, marksRanges);
  if (marks === null) {
    warnings.push('Marks not specified in question text');
  }

  const body = cleanBodyText(text, boundary.questionNumber);
  if (body.length < 10) {
    warnings.push('Question body appears too short');
  }

  return {
    questionNumber: boundary.questionNumber,
    rawText: boundary.rawText,
    body,
    type,
    options,
    answer,
    marks,
    negativeMarks,
    gateYear: defaultYear,
    paperNumber: defaultPaper,
    shift: defaultShift,
    sourceFile,
    warnings,
  };
}