"use client";
// PHASE 5 §7.3/§7.4 — per-type inputs with visual states.
import type { AttemptResponse, PublicQuestion, SessionQuestion } from "@/types/api";

interface Props {
  question: SessionQuestion;
  selected: Record<string, unknown> | null;
  onSelect: (answer: Record<string, unknown> | null) => void;
  disabled: boolean;
  gradedResult: AttemptResponse | null;
}

export function QuestionOptions({ question, selected, onSelect, disabled, gradedResult }: Props) {
  if (question.type_code === "mcq" || question.type_code === "msq") {
    const multi = question.type_code === "msq";

    // Data guard: if the session payload has no options for this question,
    // show a clear notice instead of an empty answer surface.
    if (question.options.length === 0) {
      return (
        <p className="rounded-md2 border border-dashed border-line bg-bg px-4 py-6 text-center text-sm text-muted">
          Options for this question have not been published yet. Use the palette to
          move to the next question.
        </p>
      );
    }

    const currentIds = new Set(
      Array.isArray(selected?.["option_ids"])
        ? (selected?.["option_ids"] as string[])
        : selected?.["option_id"]
          ? [selected["option_id"] as string]
          : [],
    );

    function toggle(optionId: string) {
      if (multi) {
        const next = new Set(currentIds);
        if (next.has(optionId)) next.delete(optionId);
        else next.add(optionId);
        onSelect(next.size > 0 ? { option_ids: [...next] } : null);
      } else {
        const isSelected = currentIds.has(optionId);
        // MCQ: tap toggles; clear allowed (Phase 5 §7.3).
        onSelect(isSelected ? null : { option_id: optionId });
      }
    }

    return (
      <fieldset disabled={disabled}>
        <legend className="mb-2 text-sm font-medium text-muted">
          {multi ? `Select one or more${currentIds.size > 0 ? ` · ${currentIds.size} selected` : ""}` : "Pick one answer"}
        </legend>
        <div role="group" className="flex flex-col gap-2">
          {question.options.map((option) => {
            const isSelected = currentIds.has(option.id);
            let stateClass = "border-line bg-surface hover:border-primary";
            if (isSelected && !gradedResult) stateClass = "border-primary bg-[color:var(--primary-soft)]";
            if (gradedResult) {
              // Reveal limited to what grading returned for THIS submission (no correct-id leak).
              stateClass = isSelected
                ? gradedResult.is_correct
                  ? "border-success bg-success-soft"
                  : "border-danger bg-danger-soft"
                : "border-line bg-surface opacity-70";
            }
            const glyph = gradedResult
              ? isSelected
                ? gradedResult.is_correct
                  ? "✓"
                  : "✗"
                : ""
              : isSelected
                ? "●"
                : "";
            return (
              <button
                key={option.id}
                type="button"
                role={multi ? "checkbox" : "radio"}
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => toggle(option.id)}
                className={`touch-target flex w-full items-center gap-3 rounded-md2 border px-4 py-3 text-left text-[15px] transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${stateClass}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-5 shrink-0 place-items-center border ${
                    multi ? "rounded-sm2" : "rounded-full"
                  } ${isSelected ? "border-primary bg-primary text-xs text-white" : "border-muted"}`}
                >
                  {glyph}
                </span>
                <span>{option.body}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  // NAT — numeric input + optional unit (mono, Phase 5 §7.3).
  const value = typeof selected?.["value"] === "string" || typeof selected?.["value"] === "number" ? String(selected["value"]) : "";
  const unit = typeof selected?.["unit"] === "string" ? (selected["unit"] as string) : "";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-48 flex-1 text-sm font-medium">
        Your answer
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={value}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw.trim() === "") onSelect(null);
            else onSelect({ ...selected, value: raw });
          }}
          placeholder="e.g. 10 or 1.5e-3"
          className={`mt-1 touch-target w-full rounded-sm2 border px-3 py-2 font-mono text-base ${
            gradedResult
              ? gradedResult.is_correct
                ? "border-success bg-success-soft"
                : "border-danger bg-danger-soft"
              : "border-line"
          }`}
        />
      </label>
      <label className="w-28 text-sm font-medium">
        Unit (optional)
        <input
          type="text"
          disabled={disabled}
          value={unit}
          onChange={(event) => {
            const rawUnit = event.target.value;
            const base: Record<string, unknown> = { ...(selected ?? {}) };
            if (rawUnit.trim() === "") delete base["unit"];
            else base["unit"] = rawUnit;
            onSelect(Object.keys(base).length > 0 ? base : null);
          }}
          placeholder="—"
          className="mt-1 touch-target w-full rounded-sm2 border border-line px-3 py-2 font-mono text-sm"
        />
      </label>
      <p className="w-full text-xs text-muted">
        Decimals and scientific notation accepted (e.g. 0.25, 1.5e3). Grading uses tolerance.
      </p>
    </div>
  );
}

export function questionMeta(question: PublicQuestion): string[] {
  return [
    question.subject.name,
    question.topic?.name ?? "",
    `GATE ${question.gate_year}`,
    `${question.marks} mark${question.marks === 1 ? "" : "s"}`,
    question.difficulty,
  ].filter(Boolean);
}
