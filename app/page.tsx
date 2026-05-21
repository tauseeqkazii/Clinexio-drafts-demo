"use client";
import { useState } from "react";
import { DraftPanel } from "@/components/DraftPanel";
import { LoadingState } from "@/components/LoadingState";
import type { DraftPairResponse } from "@/lib/types";
import { httpErrorLabel } from "@/lib/translate";

const PLACEHOLDER_QUERY =
  "e.g. I've been losing hair on the top of my head — do you offer laser treatment for that?";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DraftPairResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [technicalMode, setTechnicalMode] = useState(false);

  const canSubmit = query.trim().length > 0 && !loading;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/draft-pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_text: query.trim(),
          patient_first_name: patientName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        // The proxy route returns { error, detail? } shapes for known cases.
        let detail: string | null = null;
        try {
          const body = await res.json();
          detail = body?.detail ?? body?.error ?? null;
        } catch {}
        setError(detail || httpErrorLabel(res.status));
        return;
      }
      const data: DraftPairResponse = await res.json();
      setResult(data);
    } catch (err) {
      // Network error — backend unreachable / DNS / CORS
      console.error(err);
      setError(
        "Can't reach the drafts service right now. Please try again in a few minutes."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:py-14">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          Clinexio — Draft Quality Tester
        </h1>
        <p className="mt-3 max-w-2xl text-base text-ink-600">
          Type a question a patient might send, and see how the AI would
          respond for two different clinics — side by side. Use it to spot
          tone issues, hallucinations, or rogue replies before they reach
          real patients.
        </p>
      </header>

      {/* Input form */}
      <form
        onSubmit={handleGenerate}
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
          disabled={loading}
          className="mt-2 w-full resize-y rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-800 shadow-inner placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        />

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="patient"
              className="block text-sm font-medium text-ink-800"
            >
              Patient&apos;s first name{" "}
              <span className="text-ink-500 font-normal">
                (optional — used in the greeting)
              </span>
            </label>
            <input
              id="patient"
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Sarah"
              disabled={loading}
              className="mt-2 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-ink-300"
          >
            {loading ? "Generating..." : "Generate both drafts"}
          </button>
        </div>

        <p className="mt-3 text-xs text-ink-500">
          Please don&apos;t use real patient details — test conversations
          are saved for debugging.
        </p>
      </form>

      {/* Error banner */}
      {error && !loading && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800"
        >
          {error}
        </div>
      )}

      {/* Results / loading */}
      {loading ? (
        <LoadingState />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DraftPanel
            title="Secret Aesthetics"
            subtitle="Your clinic, with all the materials you've uploaded."
            accent="primary"
            result={result?.clinic_a ?? null}
            technicalMode={technicalMode}
            errorMessage={result?.clinic_a?.error ?? null}
          />
          <DraftPanel
            title="A brand-new clinic"
            subtitle="No clinic content uploaded — only the global aesthetics matrix."
            accent="neutral"
            result={result?.clinic_b ?? null}
            technicalMode={technicalMode}
            errorMessage={result?.clinic_b?.error ?? null}
          />
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 flex items-center justify-between text-xs text-ink-500">
        <span>
          Both drafts use the same AI pipeline real patients will see —
          same models, same retrieval, same safety rules.
        </span>
        <label className="flex cursor-pointer items-center gap-2 select-none">
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
