"use client";
import { useEffect, useRef, useState } from "react";
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
  accent: "primary" | "neutral";
  result: ClinicDraft | null;
  isLoading: boolean;
  errorMessage?: string | null;
  technicalMode: boolean;
  onGenerate: () => void;
  canGenerate: boolean; // false until the user has typed a question
}

export function DraftPanel({
  title,
  subtitle,
  accent,
  result,
  isLoading,
  errorMessage,
  technicalMode,
  onGenerate,
  canGenerate,
}: DraftPanelProps) {
  const panelClass =
    accent === "primary"
      ? "bg-amber-50/60 border-amber-200"
      : "bg-blue-50/60 border-blue-200";

  return (
    <section className={`rounded-xl border ${panelClass} p-5 shadow-sm`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <p className="mt-0.5 text-sm text-ink-600">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isLoading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          {isLoading
            ? "Generating..."
            : result
              ? "Regenerate"
              : "Generate this draft"}
        </button>
      </header>

      {/* Loading state — inline inside the panel */}
      {isLoading && <PanelLoading />}

      {/* Per-panel error — supersedes content */}
      {!isLoading && errorMessage && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {errorMessage}
        </div>
      )}

      {/* Empty state — before first click */}
      {!isLoading && !errorMessage && !result && (
        <div className="mt-6 rounded-md border border-dashed border-ink-300 bg-white/50 p-6 text-center text-sm italic text-ink-500">
          Click <b>Generate this draft</b> to see how the AI would
          respond for this clinic.
        </div>
      )}

      {/* Result */}
      {!isLoading && !errorMessage && result && (
        <PanelResult result={result} technicalMode={technicalMode} />
      )}
    </section>
  );
}

function PanelLoading() {
  return (
    <div className="mt-6 flex flex-col items-center justify-center py-10 text-ink-600">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-4 border-ink-200" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
      <p className="mt-4 text-sm font-medium text-ink-700">
        Drafting...
      </p>
      <p className="mt-1 text-xs text-ink-500">
        Usually 10-40 seconds.
      </p>
    </div>
  );
}

function PanelResult({
  result,
  technicalMode,
}: {
  result: ClinicDraft;
  technicalMode: boolean;
}) {
  const cls = result.classification;
  const colour = (cls?.colour_code as ColourCode) ?? null;
  const draft = result.draft;
  const status = statusLabel(draft?.status);
  const hasBody = !!draft?.body_text && draft.body_text.trim().length > 0;

  return (
    <>
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
          What the AI wrote
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

      {/* Final email preview — body wrapped in the clinic template
          (awards / press / ratings / booking link / video link).
          Sandboxed iframe so the email's own CSS doesn't leak into the
          demo page. allow-same-origin lets the parent read the
          iframe's body scrollHeight to auto-size; scripts still
          blocked since allow-scripts is NOT set. */}
      {hasBody && draft?.body_html_preview && (
        <EmailPreview html={draft.body_html_preview} />
      )}

      {/* Sources */}
      <SourcesAccordion
        chunks={result.retrieval_chunks ?? []}
        technicalMode={technicalMode}
      />

      {/* Reviewer note (technical mode only) */}
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
    </>
  );
}

/**
 * Email preview iframe that auto-sizes to its content height.
 *
 * The clinic email template ships its own CSS (font sizes, padding,
 * <table> layout for Gmail compatibility). An iframe gives perfect
 * style isolation from the demo page's Tailwind. The sandbox is
 * "allow-same-origin" — that lets the parent JS read the iframe's
 * body scrollHeight to size it correctly, while scripts inside the
 * iframe are still blocked (allow-scripts is NOT set).
 *
 * Why scale-to-fit: the email template is fixed at width=600px (Gmail
 * convention). On a narrow demo panel (~480-560px wide on a typical
 * laptop) the email overflows horizontally. We measure the panel
 * width on mount and apply a CSS transform: scale(W/600) so the email
 * shrinks to fit. Looks crisp because CSS scale is vector, not raster.
 */
function EmailPreview({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState(720);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wrapW = wrap.clientWidth;
      // Template baseline width is 600px; scale down if the panel is
      // narrower, never scale up past 1x.
      const s = Math.min(1, wrapW / 600);
      setScale(s);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const onLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      // scrollHeight reflects the real rendered content height.
      // Add a small bottom margin so the email's last row isn't
      // flush against the iframe edge.
      const h = doc.body?.scrollHeight ?? doc.documentElement.scrollHeight;
      if (h && h > 0) setBodyHeight(h + 16);
    } catch {
      // cross-origin (shouldn't happen with allow-same-origin) —
      // fall back to the default 720px which fits most emails.
    }
  };

  // Apply the scale to BOTH the iframe (so the rendered email shrinks)
  // and the wrapper height (so the scaled iframe doesn't leave a tall
  // empty space below). Visual height = bodyHeight * scale.
  const visualHeight = Math.round(bodyHeight * scale);

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-500">
          Final email preview (what the patient would see)
        </div>
        <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
          with clinic template
        </span>
      </div>
      <div
        ref={wrapRef}
        className="overflow-hidden rounded-lg border border-ink-200 bg-[#F5F3EF] shadow-inner"
        style={{ height: `${visualHeight}px` }}
      >
        <iframe
          ref={iframeRef}
          title="Final email preview"
          sandbox="allow-same-origin"
          srcDoc={html}
          onLoad={onLoad}
          style={{
            width: "600px",
            height: `${bodyHeight}px`,
            border: "0",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            display: "block",
          }}
        />
      </div>
      <p className="mt-1 text-[11px] text-ink-500">
        Includes awards, press logos, ratings, booking link and the
        video link from the clinic profile — all injected by the
        template after the AI finishes writing.
      </p>
    </div>
  );
}
