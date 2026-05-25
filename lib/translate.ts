/**
 * Doctor-friendly translations for the system's internal vocabulary.
 *
 * The Clinexio backend uses engineering terms ("tier", "clinic_id",
 * "kb_entries", "cosine similarity", "MMR"). This UI is for doctors
 * who shouldn't have to learn that vocabulary to evaluate draft
 * quality. Every system term that surfaces in the UI passes through
 * a translator below.
 *
 * Add new translations here rather than scattering string literals
 * across components.
 */

// ---------------------------------------------------------------------
// Colour code → plain label + visual tone
// ---------------------------------------------------------------------
export type ColourCode =
  | "red"
  | "amber"
  | "green"
  | "blue"
  | "yellow"
  | "purple"
  | "grey"
  | "marketing"
  | null;

export const COLOUR_LABEL: Record<NonNullable<ColourCode>, string> = {
  red: "Urgent escalation",
  amber: "Concern / complaint",
  green: "Post-treatment question",
  blue: "Pre-treatment / admin",
  yellow: "New enquiry",
  purple: "System notification",
  grey: "Spam / vendor",
  marketing: "Marketing",
};

export const COLOUR_DOT: Record<NonNullable<ColourCode>, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  blue: "bg-blue-500",
  yellow: "bg-yellow-400",
  purple: "bg-purple-500",
  grey: "bg-slate-400",
  marketing: "bg-pink-500",
};

export function colourLabel(c: ColourCode): string {
  if (!c) return "Unclassified";
  return COLOUR_LABEL[c] ?? c;
}

// ---------------------------------------------------------------------
// Template hint (sub-template) → plain label
// ---------------------------------------------------------------------
// The classifier picks one of ~23 sub-templates per the AI tone doc
// (red sub-types, amber refund/dissatisfaction/post-tx-concern,
// yellow pathways A/B/C, blue pre-treatment / complex medical, green
// aftercare/top-up/info/booking, plus grey + purple). The doctor
// shouldn't see the enum string — show a plain label.
export const TEMPLATE_HINT_LABEL: Record<string, string> = {
  // Red sub-templates
  red_medical_emergency: "Urgent clinical emergency",
  red_legal_threat: "Legal threat / regulator",
  red_mental_health_crisis: "Mental health crisis",
  red_pregnancy_safety: "Pregnancy safety",
  red_minor_patient: "Minor patient",
  // Amber sub-templates
  amber_complaint_concern: "Generic complaint",
  amber_dissatisfaction: "Dissatisfaction with outcome",
  amber_refund_only: "Refund request",
  amber_post_treatment_concern: "Post-treatment concern (clinician review)",
  // Green sub-templates
  green_aftercare: "Aftercare advice",
  green_post_treatment_info: "Post-treatment info (product / units)",
  green_post_treatment_booking: "Post-treatment booking",
  green_top_up_request: "Top-up request",
  // Blue sub-templates
  blue_pre_treatment_safety: "Pre-treatment safety (covered by KB)",
  blue_pre_treatment_admin: "Pre-treatment admin / booking",
  blue_complex_medical_history_awaiting_clinical:
    "Complex medical history — awaiting clinician",
  // Yellow lead pathways
  yellow_new_enquiry: "New enquiry",
  yellow_pathway_a_unsure: "Pathway A — unsure / multiple concerns",
  yellow_pathway_b_not_offered: "Pathway B — specific treatment not offered",
  yellow_pathway_c_returning_known: "Pathway C — knows what they want",
  // Grey + purple
  grey_spam: "Spam",
  grey_off_topic: "Off-topic",
  purple_notification: "External notification",
};

export function templateHintLabel(hint: string | null | undefined): string | null {
  if (!hint) return null;
  return TEMPLATE_HINT_LABEL[hint] ?? hint;
}

// ---------------------------------------------------------------------
// Source tier (clinic / platform) → plain label
// ---------------------------------------------------------------------
export function tierLabel(tier: string | null | undefined): string {
  if (tier === "clinic") return "from your clinic's uploaded materials";
  if (tier === "platform") return "from the global aesthetics matrix";
  if (tier === "llm_gated") return "AI training knowledge";
  return tier ?? "unknown source";
}

export function tierShortLabel(tier: string | null | undefined): string {
  if (tier === "clinic") return "your clinic";
  if (tier === "platform") return "global matrix";
  if (tier === "llm_gated") return "AI training";
  return tier ?? "unknown";
}

// ---------------------------------------------------------------------
// Cosine similarity (0.0-1.0) → percentage match
// ---------------------------------------------------------------------
export function similarityPercent(score: number | string | null | undefined): string {
  if (score == null) return "—";
  const n = typeof score === "string" ? parseFloat(score) : score;
  if (Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}% match`;
}

// ---------------------------------------------------------------------
// Sheet / source-file friendly names. The Master Matrix xlsx has
// internal sheet names like `MANUFACTURERS_PORTFOLIO`; map them to
// human-readable section titles.
// ---------------------------------------------------------------------
const SHEET_LABEL: Record<string, string> = {
  README_AI: "Matrix overview",
  LEGAL_DISCLAIMERS: "Legal disclaimers",
  TREATMENTS_SERVICES: "Treatments & services",
  CONDITIONS_CONCERNS: "Conditions & concerns",
  MANUFACTURERS_PORTFOLIO: "Manufacturers portfolio",
  PRODUCTS_DEVICES_DRUGS: "Products, devices & drugs",
  CONTRAINDICATIONS_MASTER: "Contraindications",
  CITATIONS_EVIDENCE: "Citations / evidence",
};

export function sheetLabel(sheet: string | null | undefined): string {
  if (!sheet) return "";
  return SHEET_LABEL[sheet] ?? sheet;
}

// ---------------------------------------------------------------------
// Draft status → reassuring sentence for the doctor
// ---------------------------------------------------------------------
export function statusLabel(status: string | null | undefined): {
  label: string;
  tone: "ok" | "warn" | "error";
} {
  switch (status) {
    case "pending_review":
      return { label: "Draft ready for review", tone: "ok" };
    case "guardrail_failed":
      return {
        label: "Safety check blocked this draft — flagged for human review",
        tone: "warn",
      };
    case "model_unavailable":
      return {
        label: "The AI was slow — please try again",
        tone: "warn",
      };
    case "budget_exceeded":
      return { label: "Daily AI budget reached for this clinic", tone: "warn" };
    case "empty_output":
      return { label: "AI didn't produce a response — try rephrasing", tone: "warn" };
    case "prompt_assembly_failed":
      return { label: "Internal configuration issue — please contact admin", tone: "error" };
    case "unexpected_failure":
      return { label: "Something went wrong — please try again", tone: "error" };
    default:
      return { label: status ?? "No draft", tone: "warn" };
  }
}

// ---------------------------------------------------------------------
// Backend HTTP error code → friendly UI message
// ---------------------------------------------------------------------
export function httpErrorLabel(status: number): string {
  if (status === 401) return "Configuration issue — please contact your admin";
  if (status === 429)
    return "Too many tests in a row — give it 60 seconds and try again";
  if (status === 503)
    return "The drafts service isn't ready yet — please try again in a few minutes";
  if (status >= 500)
    return "Server error — please try again in a moment";
  if (status === 408)
    return "The AI took too long — please try again";
  return `Unexpected error (code ${status})`;
}
