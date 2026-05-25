/**
 * Wire shape between the Next.js server route and the Clinexio API.
 *
 * Mirrors the response shape of `/api/v1/test/draft-pair` on the
 * backend. If the backend payload changes, update this file + the
 * components reading these fields. Defensive parsing happens in
 * `app/api/draft-pair/route.ts` so the page components can assume
 * the shape below.
 */

export interface RetrievalChunk {
  tier: "clinic" | "platform" | "llm_gated" | string;
  score: number | null;
  excerpt: string;
  sheet?: string | null;
  source_file?: string | null;
  kb_entry_id?: string | null;
}

export interface ClassificationSummary {
  colour_code: string | null;
  pathway: string | null;
  category_detail: string | null;
  requires_clinical_review: boolean | null;
  reviewer_note: string | null;
  /**
   * 2026-05-28 — sub-template selection from the classifier. One of
   * the ~23 closed-enum values (red_medical_emergency,
   * amber_refund_only, yellow_pathway_a_unsure, etc.). The UI maps
   * this to a friendly label via lib/translate.ts:templateHintLabel.
   * Nullable — older classifier outputs / failures return null.
   */
  template_hint: string | null;
}

export interface DraftResult {
  status: string | null;          // "pending_review" | "guardrail_failed" | ...
  body_text: string | null;
  rejected_reason: string | null;
  // Server-rendered preview — the body_text wrapped in the same clinic
  // template the production outbound email path uses. Contains awards,
  // press tagline, ratings, booking CTA, [first name] substitution.
  // Null when the renderer wasn't able to run for this draft.
  body_html_preview?: string | null;
}

export interface ClinicDraft {
  clinic_label: string;           // "Secret Aesthetics" / "Demo Clinic" — backend-supplied
  classification: ClassificationSummary | null;
  draft: DraftResult | null;
  retrieval_chunks: RetrievalChunk[];
  // Friendly per-clinic error if this side failed but the request as a
  // whole succeeded. The other clinic may still have rendered.
  error?: string | null;
}

// Single-clinic response — the page makes two of these (one per panel)
// and renders each independently as its fetch resolves.
export interface DraftSingleResponse {
  clinic: ClinicDraft;
  elapsed_ms: number;
}

export type ClinicKey = "sa" | "demo";

// Backend may surface API-level errors with this shape; the proxy
// route catches them and converts to a friendly UI message via
// `httpErrorLabel`.
export interface BackendErrorEnvelope {
  error: string;
  detail?: string;
}

export interface DraftSingleRequest {
  query_text: string;
  patient_first_name?: string;
  clinic: ClinicKey;
}
