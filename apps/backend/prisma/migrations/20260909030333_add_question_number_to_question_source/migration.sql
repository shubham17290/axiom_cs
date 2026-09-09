-- Add question_number to question_sources for GATE PYQ identity tracking.
ALTER TABLE "question_sources" ADD COLUMN "question_number" INTEGER;

-- Unique partial index: enforces uniqueness only when all identity fields are populated.
-- PostgreSQL treats NULLs as distinct in unique indexes, so rows with NULL in any
-- field are not constrained. This ensures only fully-specified GATE questions
-- (year + paper + shift + question number) are deduplicated.
CREATE UNIQUE INDEX "uq_question_sources_identity"
ON "question_sources" ("exam_year", "paper_number", "shift", "question_number")
WHERE "paper_number" IS NOT NULL AND "shift" IS NOT NULL AND "question_number" IS NOT NULL;
