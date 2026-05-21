"use client";
import type { ClinicDraft } from "@/lib/types";
import {
  COLOUR_DOT,
  colourLabel,
  statusLabel,
  type ColourCode,
} from "@/lib/translate";
import { SourcesAccordion } from "./SourcesAccordion";

interface DraftPanelProps {
  title: string;
  subtitle: string;
  accent: "primary" | "neutral";   // visual cue: SA vs Demo Clinic
  result: ClinicDraft | null;
  technicalMode: boolean;
  // Friendly error message to render if this panel failed but the
  // other one succeeded. Null when fine.
  errorMessage?: string | null;
}

export function DraftPanel({
  title,
  subtitle,
  accent,
  result,
  technicalMode,
  errorMessage,
}: DraftPanelProps) {
  const panelClass =
    accent === "primary"
      ? "bg-amber-50/60 border-amber-200"
      : "bg-blue-50/60 border-blue-200";

  // Per-panel error supersedes everything
  if (errorMessage) {
    return (
      <section className={`rounded-xl border ${panelClass} p-5 shadow-sm`}>
        <PanelHeader title={title} subtitle={subtitle} />
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {errorMessage}
        </div>
      </section>
    );
  }

  // No result yet (initial render before submit)
  if (!result) {
    return (
      <section
        className={`rounded-xl border ${panelClass} p-5 shadow-sm`}
        aria-live="polite"
      >
        <PanelHeader title={title} subtitle={subtitle} />
        <div className="mt-6 text-sm italic text-ink-500">
          Type a patient question above and click <b>Generate</b> to see
          the draft.
        </div>
      </section>
    );
  }

  const cls = result.classification;
  const colour = (cls?.colour_code as ColourCode) ?? null;
  const draft = result.draft;
  const status = statusLabel(draft?.status);
  const hasBody = !!draft?.body_text && draft.body_text.trim().length > 0;

  return (
    <section className={`rounded-xl border ${panelClass} p-5 shadow-sm`}>
      <PanelHeader title={title} subtitle={subtitle} />

      {/* Category + status row */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {colour && (
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-ink-700 ring-1 ring-ink-200">
            <span
              className={`h-2.5 w-2.5 rounded-full ${COLOUR_DOT[colour] || "bg-slate-300"}`}
              aria-hidden
            />
            {colourLabel(colour)}
          </span>
        )}
        <span
          className={`text-xs font-medium ${
            status.tone === "ok"
              ? "text-emerald-700"
              : status.tone === "warn"
                ? "text-amber-700"
                : "text-red-700"
          }`}
        >
          {status.label}
        </span>
        {technicalMode && cls?.pathway && (
          <span className="ml-auto rounded bg-white px-2 py-0.5 font-mono text-[11px] text-ink-600 ring-1 ring-ink-200">
            pathway={cls.pathway}
          </span>
        )}
      </div>

      {/* Draft body */}
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
          Draft email
        </div>
        {hasBody ? (
          <article className="whitespace-pre-wrap rounded-lg border border-ink-200 bg-white p-4 text-[15px] leading-relaxed text-ink-800">
            {draft!.body_text}
          </article>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm italic text-amber-800">
            {draft?.rejected_reason
              ? draft.rejected_reason
              : "No draft was produced for this clinic."}
          </div>
        )}
      </div>

      {/* Sources accordion */}
      <SourcesAccordion
        chunks={result.retrieval_chunks ?? []}
        technicalMode={technicalMode}
      />

      {/* Technical-mode footer: reviewer note */}
      {technicalMode && cls?.reviewer_note && (
        <details className="mt-3 text-xs text-ink-600">
          <summary className="cursor-pointer font-medium text-ink-700">
            Classifier reviewer note
          </summary>
          <p className="mt-1 whitespace-pre-wrap rounded bg-ink-50 p-2">
            {cls.reviewer_note}
          </p>
        </details>
      )}
    </section>
  );
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <p className="mt-0.5 text-sm text-ink-600">{subtitle}</p>
    </header>
  );
}
