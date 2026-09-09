import { extractPDFText } from '../src/ingestion/pdf-extractor.js';
import { detectQuestionBoundaries, parseQuestion, MarksRange } from '../src/ingestion/question-parser.js';

function extractMarksRangesFromText(text: string): MarksRange[] {
  const ranges: MarksRange[] = [];
  const pattern = /Q\.\s*(\d+)\s*[–-]\s*Q\.\s*(\d+)\s+Carry\s+(one|two)\s+marks?(?:\s+each)?/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    const marks = match[3].toLowerCase() === 'one' ? 1 : 2;
    ranges.push({ start, end, marks });
  }
  return ranges;
}

const result = await extractPDFText('apps/backend/data/raw/CS/2023_CS.pdf');
const marksRanges = extractMarksRangesFromText(result.text);
console.log('Marks ranges:', marksRanges);

const boundaries = detectQuestionBoundaries(result.text);
console.log('Boundaries:', boundaries.length);

for (const boundary of boundaries.slice(0, 10)) {
  const { parseQuestion } = await import('../src/ingestion/question-parser.js');
  const q = parseQuestion(boundary, 'test.pdf', 2023, null, null, marksRanges);
  console.log(`Q${q.questionNumber}: marks=${q.marks}, type=${q.type}`);
}