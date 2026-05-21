"use client";
import { useState } from "react";
import type { RetrievalChunk } from "@/lib/types";
import {
  sheetLabel,
  similarityPercent,
  tierLabel,
  tierShortLabel,
} from "@/lib/translate";

/**
 * Collapsible "Show what the AI used" panel.
 *
 * Two modes:
 *   - Simple (default): "From your clinic's KB → Profhilo leaflet (87% match)"
 *   - Technical (toggled at page level): includes tier, score (0.0-1.0),
 *     full excerpt, kb_entry_id.
 */
export function SourcesAccordion({
  chunks,
  technicalMode,
}: {
  chunks: RetrievalChunk[];
  technicalMode: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!chunks || chunks.length === 0) {
    return (
      <div className="mt-3 text-xs italic text-ink-500">
        The AI didn&apos;t use any specific clinic references for this draft —
        it relied on its general training knowledge plus the clinic&apos;s
        tone profile.
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        <span
          className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▶
        </span>
        {open ? "Hide" : "Show"} what the AI used ({chunks.length})
      </button>

      {open && (
        <ol className="mt-3 space-y-2 rounded-md border border-ink-200 bg-ink-50 p-3 text-sm">
          {chunks.map((c, idx) => {
            const sectionLabel =
              c.sheet || c.source_file
                ? sheetLabel(c.sheet || c.source_file || "")
                : null;

            return (
              <li key={idx} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium text-ink-700">
                    {idx + 1}.
                  </span>
                  <span className="text-ink-700">
                    {tierLabel(c.tier)}
                    {sectionLabel ? (
                      <>
                        {" "}
                        <span className="text-ink-500">→</span>{" "}
                        <span className="font-medium">{sectionLabel}</span>
                      </>
                    ) : null}
                  </span>
                  <span className="text-xs text-ink-500">
                    ({similarityPercent(c.score)})
                  </span>
                </div>

                {/* Technical view: raw fields + chunk excerpt */}
                {technicalMode && (
                  <div className="ml-5 mt-1 space-y-1 text-xs text-ink-600">
                    <div className="flex flex-wrap gap-3 font-mono">
                      <span>
                        tier=<b>{c.tier ?? "?"}</b>
                      </span>
                      <span>
                        score=<b>{c.score ?? "—"}</b>
                      </span>
                      {c.kb_entry_id && (
                        <span title="kb_entries.id">
                          id=<b>{c.kb_entry_id.substring(0, 8)}…</b>
                        </span>
                      )}
                    </div>
                    <pre className="whitespace-pre-wrap rounded bg-white p-2 text-[11px] leading-snug text-ink-700">
                      {c.excerpt || "(empty)"}
                    </pre>
                  </div>
                )}

                {/* Simple view: short tier+section reference, no raw text */}
                {!technicalMode && (
                  <div className="ml-5 text-xs text-ink-500">
                    From <b>{tierShortLabel(c.tier)}</b>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
