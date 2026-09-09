import { extractPDFText, parseGATEFileName, resolveRawPDFPath, listRawPDFFiles } from './pdf-extractor.js';
import { detectQuestionBoundaries, parseQuestion, extractMarksRanges } from './question-parser.js';
import { validateQuestion, validateQuestions, getValidationSummary } from './validator.js';
import { checkAllDuplicates } from './duplicate-detector.js';
import { createStagingOutput, writeStagingFile, writeHumanReport, generateHumanReport } from './staging.js';
import type { ParsedQuestion, PDFExtractResult } from './pdf-extractor.js';

export interface MarksRange {
  start: number;
  end: number;
  marks: number;
}

export interface PipelineOptions {
  pilotOnly?: boolean;
  pilotFile?: string;
  outputStaging?: boolean;
  outputReport?: boolean;
  maxQuestions?: number;
}

export interface PipelineResult {
  extractResult: PDFExtractResult;
  questions: ParsedQuestion[];
  validationResults: Awaited<ReturnType<typeof validateQuestions>>;
  validationSummary: ReturnType<typeof getValidationSummary>;
  duplicates: Map<string, number[]>;
  stagingFilePath?: string;
  reportFilePath?: string;
  report?: string;
}

function extractMarksRangesFromText(text: string): MarksRange[] {
  const ranges: MarksRange[] = [];
  const lines = text.split('\n');
  console.log(`[DEBUG] Total lines: ${lines.length}`);
  console.log(`[DEBUG] Line 4: "${lines[4]?.trim()}"`);
  console.log(`[DEBUG] Line 61: "${lines[61]?.trim()}"`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed.toLowerCase().includes('carry')) continue;
    console.log(`[DEBUG] Processing line ${i}: "${trimmed}"`);
    
    // Match patterns like:
    // "– Q.5 Carry ONE mark Each"
    // "Q.6 – Q.10 Carry TWO marks Each"
    // "Q.11 – Q.35 Carry ONE mark each."
    // "Q.36 – Q.65 Carry TWO mark each."
    
    // Try pattern with start and end: "Q.X – Q.Y Carry ..."
    let match = trimmed.match(/Q\.\s*(\d+)\s*[–-]\s*Q\.\s*(\d+)\s+Carry\s+(one|two)\s+marks?(?:\s+[Ee]ach)?/i);
    if (match) {
      ranges.push({
        start: parseInt(match[1], 10),
        end: parseInt(match[2], 10),
        marks: match[3].toLowerCase() === 'one' ? 1 : 2,
      });
      continue;
    }
    
    // Try pattern with leading dash: "– Q.Y Carry ..."
    match = trimmed.match(/[–-]\s*Q\.\s*(\d+)\s+Carry\s+(one|two)\s+marks?(?:\s+[Ee]ach)?/i);
    if (match) {
      console.log(`[DEBUG] Matched leading dash: "${trimmed}" -> start=1, end=${match[1]}, marks=${match[2]}`);
      ranges.push({
        start: 1,
        end: parseInt(match[1], 10),
        marks: match[2].toLowerCase() === 'one' ? 1 : 2,
      });
      continue;
    }
  }
  
  return ranges;
}

export async function runIngestionPipeline(
  fileName: string,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const { outputStaging = true, outputReport = true } = options;

  const filePath = resolveRawPDFPath(fileName);
  const parsedFileName = parseGATEFileName(fileName);

  const extractResult = await extractPDFText(filePath);

  const marksRanges = extractMarksRangesFromText(extractResult.text);

  const boundaries = detectQuestionBoundaries(extractResult.text);

  let questions: ParsedQuestion[] = [];
  for (const boundary of boundaries) {
    const question = parseQuestion(
      boundary,
      fileName,
      parsedFileName?.year ?? null,
      parsedFileName?.paper ?? null,
      parsedFileName?.shift ?? null,
      marksRanges
    );
    questions.push(question);
  }

  const duplicates = checkAllDuplicates(questions);
  for (const [identity, indices] of duplicates) {
    for (const idx of indices.slice(1)) {
      questions[idx].warnings.push(`DUPLICATE: Same source identity as question at index ${indices[0]}`);
    }
  }

  const validationResults = validateQuestions(questions);
  const validationSummary = getValidationSummary(validationResults);

  let stagingFilePath: string | undefined;
  let reportFilePath: string | undefined;
  let report: string | undefined;

  if (outputStaging) {
    const stagingOutput = createStagingOutput(
      questions,
      fileName,
      parsedFileName?.year ?? 0,
      parsedFileName?.paper ?? null,
      parsedFileName?.shift ?? null
    );
    stagingFilePath = writeStagingFile(stagingOutput);
  }

  if (outputReport) {
    const stagingOutput = createStagingOutput(
      questions,
      fileName,
      parsedFileName?.year ?? 0,
      parsedFileName?.paper ?? null,
      parsedFileName?.shift ?? null
    );
    reportFilePath = writeHumanReport(stagingOutput);
    report = generateHumanReport(stagingOutput);
  }

  return {
    extractResult,
    questions,
    validationResults,
    validationSummary,
    duplicates,
    stagingFilePath,
    reportFilePath,
    report,
  };
}

export async function runPilotPipeline(): Promise<PipelineResult> {
  const files = listRawPDFFiles();
  const pilotFile = files.find(f => f.startsWith('2023_')) ?? files[0];

  console.log(`Running pilot on: ${pilotFile}`);
  return runIngestionPipeline(pilotFile);
}

export function printPipelineSummary(result: PipelineResult): void {
  console.log('\n========== PIPELINE SUMMARY ==========');
  console.log(`File: ${result.extractResult.fileName}`);
  console.log(`Pages: ${result.extractResult.numPages}`);
  console.log(`Text Length: ${result.extractResult.text.length} chars`);
  console.log(`Questions Detected: ${result.questions.length}`);
  console.log(`Valid: ${result.validationSummary.valid}`);
  console.log(`Warnings: ${result.validationSummary.warning}`);
  console.log(`Invalid: ${result.validationSummary.invalid}`);
  console.log(`Total Issues: ${result.validationSummary.totalIssues}`);
  console.log(`Duplicates Found: ${result.duplicates.size}`);

  if (result.stagingFilePath) {
    console.log(`Staging File: ${result.stagingFilePath}`);
  }
  if (result.reportFilePath) {
    console.log(`Report File: ${result.reportFilePath}`);
  }

  if (result.extractResult.warnings.length > 0) {
    console.log('\nExtraction Warnings:');
    for (const w of result.extractResult.warnings) {
      console.log(`  - ${w}`);
    }
  }

  console.log('\n========== END SUMMARY ==========\n');
}