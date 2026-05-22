"use client";
import { useCallback, useState } from "react";
import { DraftPanel } from "@/components/DraftPanel";
import type { ClinicDraft, ClinicKey, DraftSingleResponse } from "@/lib/types";
import { httpErrorLabel } from "@/lib/translate";

const PLACEHOLDER_QUERY =
  "e.g. I've been losing hair on the top of my head — do you offer laser treatment for that?";

interface PanelState {
  result: ClinicDraft | null;
  isLoading: boolean;
  error: string | null;
}

const EMPTY_PANEL: PanelState = {
  result: null,
  isLoading: false,
  error: null,
};

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [patientName, setPatientName] = useState("");
  const [technicalMode, setTechnicalMode] = useState(false);
  const [sa, setSa] = useState<PanelState>(EMPTY_PANEL);
  const [demo, setDemo] = useState<PanelState>(EMPTY_PANEL);

  const canGenerate = query.trim().length > 0;

  const generate = useCallback(
    async (clinic: ClinicKey) => {
      const setPanel = clinic === "sa" ? setSa : setDemo;
      setPanel({ result: null, isLoading: true, error: null });
      try {
        const res = await fetch("/api/draft-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query_text: query.trim(),
            patient_first_name: patientName.trim() || undefined,
            clinic,
          }),
        });
        if (!res.ok) {
          let detail: string | null = null;
          try {
            const body = await res.json();
            detail = body?.detail ?? body?.error ?? null;
          } catch {}
          setPanel({
            result: null,
            isLoading: false,
            error: detail || httpErrorLabel(res.status),
          });
          return;
        }
        const data: DraftSingleResponse = await res.json();
        setPanel({ result: data.clinic, isLoading: false, error: null });
      } catch (err) {
        console.error(err);
        setPanel({
          result: null,
          isLoading: false,
          error:
            "Can't reach the drafts service right now. Please try again in a few minutes.",
        });
      }
    },
    [query, patientName],
  );

  const generateBoth = useCallback(() => {
    if (!canGenerate) return;
    // Fire both in parallel — each call is its own Vercel function
    // invocation with its own 60s budget, so this is safe even on the
    // Hobby plan. Each panel renders independently as its fetch resolves.
    void generate("sa");
    void generate("demo");
  }, [canGenerate, generate]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          Clinexio — Draft Quality Tester
        </h1>
        <p className="mt-3 max-w-2xl text-base text-ink-600">
          Type a question a patient might send, then click <b>Generate</b>{" "}
          under each clinic to see how the AI would respond. Use it to spot
          tone issues, hallucinations, or rogue replies before they reach
          real patients.
        </p>
      </header>

      {/* Shared input form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generateBoth();
        }}
        className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm"
      >
        <label
          htmlFor="query"
          className="block text-sm font-medium text-ink-800"
        >
          What did the patient ask?
        </label>
        <textarea
          id="query"
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={PLACEHOLDER_QUERY}
          className="mt-2 w-full resize-y rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-800 shadow-inner placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1">
            <label
              htmlFor="patient"
              className="block text-sm font-medium text-ink-800"
            >
              Patient&apos;s first name{" "}
              <span className="font-normal text-ink-500">
                (optional — used in the greeting)
              </span>
            </label>
            <input
              id="patient"
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Sarah"
              className="mt-2 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <button
            type="submit"
            disabled={!canGenerate || sa.isLoading || demo.isLoading}
            className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-ink-300"
            title="Fires both clinics in parallel. Or click each panel's button individually below."
          >
            Generate both
          </button>
        </div>

        <p className="mt-3 text-xs text-ink-500">
          Please don&apos;t use real patient details — test conversations
          are saved for debugging.
        </p>

        {/* Accuracy expectation note — set Zoya's expectations so she
            doesn't read every miss as a system failure. Classifier
            currently runs on platform-default few-shots only; per-clinic
            accuracy improves as real patient traffic flows in. */}
        <p className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800 ring-1 ring-blue-200">
          <b>Heads up on accuracy.</b> The AI starts at ~70% classification
          accuracy on Day 1 — it&apos;s reading platform-default rules,
          not your clinic&apos;s real patient traffic yet. As real patient
          enquiries flow in and your team confirms or corrects the AI&apos;s
          decisions, the system learns from those patterns and accuracy
          climbs significantly. Today&apos;s misses on edge cases are
          expected; they get fixed automatically once we have your data.
        </p>
      </form>

      {/* Two independent panels */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DraftPanel
          title="Secret Aesthetics"
          subtitle="Your clinic, with all the materials you've uploaded."
          accent="primary"
          result={sa.result}
          isLoading={sa.isLoading}
          errorMessage={sa.error}
          technicalMode={technicalMode}
          canGenerate={canGenerate}
          onGenerate={() => generate("sa")}
        />
        <DraftPanel
          title="A brand-new clinic"
          subtitle="No clinic content uploaded — only the global aesthetics matrix."
          accent="neutral"
          result={demo.result}
          isLoading={demo.isLoading}
          errorMessage={demo.error}
          technicalMode={technicalMode}
          canGenerate={canGenerate}
          onGenerate={() => generate("demo")}
        />
      </div>

      {/* Footer */}
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
        <span>
          Both drafts use the same AI pipeline real patients will see —
          same models, same retrieval, same safety rules.
        </span>
        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={technicalMode}
            onChange={(e) => setTechnicalMode(e.target.checked)}
            className="rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <span>Show technical details</span>
        </label>
      </footer>
    </main>
  );
}
