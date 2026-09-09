// PHASE 8 — Questions API (Phase 4 §2.3, §3.2.14)
import { Router } from "express";
import { requireAuth } from "../../core/middleware/auth";
import { DIFFICULTIES, QUESTION_TYPE_CODES } from "../../core/config/env";
import { errors } from "../../core/errors";
import { findQuestionById, listPublishedQuestions } from "../../core/repositories/questions.repo";
import { asyncHandler, ok, pageParams, paginationMeta } from "../../core/utils/http";
import { Validator, isUuid } from "../../core/validation/schema";
import { publicQuestionView } from "../subjects/subjects.routes";

export const questionsRouter = Router();

const SORT_COLUMNS = ["year", "difficulty", "id"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function buildOrderBy(sortParam: string | undefined) {
  let column: SortColumn = "id";
  let direction: "asc" | "desc" = "asc";
  if (sortParam !== undefined && sortParam.length > 0) {
    const raw = sortParam.startsWith("-") ? sortParam.slice(1) : sortParam;
    if (!(SORT_COLUMNS as readonly string[]).includes(raw)) {
      throw errors.validation([{ field: "sort", code: "VALIDATION_INVALID_SORT", message: `"sort" must be one of: ${SORT_COLUMNS.join(", ")}.` }]);
    }
    column = raw as SortColumn;
    direction = sortParam.startsWith("-") ? "desc" : "asc";
  }
  const field = column === "year" ? "gateYear" : column;
  return [{ [field]: direction } as Record<string, "asc" | "desc">];
}

questionsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const v = new Validator(req.query);
    v.strictKeys(["subject_id", "topic_id", "year", "difficulty", "type", "page", "page_size", "sort", "include_answer", "question_number", "source_id"]);
    const subjectId = v.uuid("subject_id");
    const topicId = v.uuid("topic_id");
    const year = v.int("year", { min: 1990 });
    const difficulty = v.enumOf("difficulty", DIFFICULTIES);
    const typeCode = v.enumOf("type", QUESTION_TYPE_CODES);
    const sort = v.string("sort", { max: 16 });
    const includeAnswer = req.query["include_answer"] === "true" ? true : req.query["include_answer"] === undefined ? undefined : false;
    const questionNumber = v.int("question_number", { min: 1 });
    const sourceId = v.uuid("source_id");
    v.finish();
    if (includeAnswer === true && req.principal?.roleCode !== "admin") {
      throw errors.role("Answer reveal is restricted to admins.");
    }

    const query = pageParams(req.query["page"], req.query["page_size"]);
     const { items, total } = await listPublishedQuestions(
       {
         ...(subjectId ? { subjectId } : {}),
         ...(topicId ? { topicId } : {}),
         ...(year !== undefined ? { year } : {}),
         ...(difficulty ? { difficulty } : {}),
         ...(typeCode ? { typeCode } : {}),
         ...(questionNumber !== undefined ? { questionNumber } : {}),
         ...(sourceId ? { sourceId } : {}),
       },
       query.page,
       query.pageSize,
       buildOrderBy(sort),
     );

    const base = items.map(publicQuestionView);
    if (includeAnswer === true) {
      for (let index = 0; index < base.length; index += 1) {
        base[index]["answers"] = await answerViewFor(items[index].id);
      }
    }
    ok(res, 200, { items: base, meta: paginationMeta(query, total) });
  }),
);

questionsRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params["id"];
    if (!id || !isUuid(id)) throw errors.notFound("QUESTION_NOT_FOUND", "Question not found.");

    const question = await findQuestionById(id);
    if (!question) throw errors.notFound("QUESTION_NOT_FOUND", "Question not found.");

    const privileged = req.principal?.roleCode === "admin" || req.principal?.roleCode === "moderator";
    if (question.status !== "published" && !privileged) {
      // Students never learn a non-published question exists.
      throw errors.notFound("QUESTION_NOT_FOUND", "Question not found.");
    }

    const view = publicQuestionView(question);
    view["status"] = question.status;
    if (privileged) {
      view["explanation"] = question.explanation;
      view["answers"] = await answerViewFor(question.id);
    }
    ok(res, 200, view);
  }),
);

async function answerViewFor(questionId: string): Promise<Record<string, unknown>> {
  const question = await findQuestionById(questionId);
  return {
    options: question?.options.map((option) => ({ id: option.id, body: option.body, is_correct: option.isCorrect })) ?? [],
    numeric_answers:
      question?.numericAnswers.map((answer) => ({
        numeric_value: Number(answer.numericValue),
        tolerance_abs: answer.toleranceAbs === null ? null : Number(answer.toleranceAbs),
        tolerance_rel: answer.toleranceRel === null ? null : Number(answer.toleranceRel),
        unit: answer.unit,
        precision: answer.precision,
      })) ?? [],
  };
}
