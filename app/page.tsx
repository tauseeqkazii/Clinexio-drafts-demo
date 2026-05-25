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

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:py-14">
      {/* Hero */}
      <header className="mb-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-cyan-200">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
          Draft Quality Tester
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          See what the AI would write — before it reaches a patient.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-ink-600">
          Type a question a patient might send, then click{" "}
          <b>Generate this draft</b> under each clinic to compare how the AI
          responds with your uploaded materials versus with the platform
          defaults alone.
        </p>
      </header>

      {/* Accuracy expectation callout — set Zoya's expectations early
          so today's edge-case misses read as "system learning",
          not "system broken". Wording requested by TK 2026-05-22. */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="text-sm leading-relaxed text-ink-800">
          We currently believe the accuracy of responses to be around{" "}
          <b>60%</b>. This will gradually grow with the feedback loop as
          your team confirms or corrects the AI&apos;s decisions on real
          patient traffic.
        </div>
      </div>

      {/* Shared input — no submit button; each panel has its own
          Generate. Form just prevents accidental page-reload on Enter. */}
      <form
        onSubmit={(e) => e.preventDefault()}
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

        <div className="mt-4">
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
            className="mt-2 w-full max-w-md rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <p className="mt-4 text-xs text-ink-500">
          Each query is treated as a fresh first message. In production the AI
          also reads the patient&apos;s prior conversation history — so
          slow-burn patterns (multiple mild messages adding up over time) are
          caught there, not in this single-query tester. Use the{" "}
          <b>Generate this draft</b> button on each panel below.
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
