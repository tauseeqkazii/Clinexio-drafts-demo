import { NextResponse } from "next/server";

/**
 * Server-side proxy from the browser to the Clinexio API's
 * /api/v1/test/draft-single endpoint.
 *
 * Why two parallel calls instead of one combined call:
 *   The earlier /api/v1/test/draft-pair endpoint runs BOTH clinic
 *   pipelines inside a single backend request. Wall time = max(SA,
 *   Demo) ≈ 30-50s normally — fine locally, but on AWS the parallel
 *   Sonnet calls share the same eu-west-2 TPM bucket and queue, so
 *   the combined request regularly exceeds 60s and hits the ALB idle
 *   timeout (default 60s; bumped to 180s for this dev env). Even
 *   180s wasn't reliable; Vercel Hobby caps at 60s anyway.
 *
 *   This proxy fires Promise.all to /test/draft-single TWICE (one per
 *   clinic), so each HTTP call is ~30-45s — well under both the ALB
 *   ceiling and Vercel Hobby's 60s cap. Then we merge the two
 *   responses into the same { clinic_a, clinic_b, elapsed_ms } shape
 *   the page already consumes — the UI components don't change.
 *
 * Why a proxy exists at all (security):
 *   The bearer secret (`DEMO_DRAFT_PAIR_SECRET`) MUST NOT ship to the
 *   browser. Keeping it on the server side means anyone inspecting
 *   the network tab sees only same-origin calls to /api/draft-pair;
 *   the AWS API URL + secret stay invisible.
 *
 * Auth model:
 *   - `DEMO_DRAFT_PAIR_SECRET` (Vercel server-only env var) — bearer
 *     token sent to the AWS API.
 *   - `NEXT_PUBLIC_API_URL` — public env var with the AWS API base URL.
 *
 * Rate limiting / abuse protection happens server-side on the AWS API
 * (10 req/min per IP). This proxy doesn't re-implement that. Note: a
 * single user click = 2 backend requests, so the 10/min limit allows
 * ~5 clicks/min per IP.
 */

export const runtime = "nodejs";
// Each /test/draft-single call is ~30-45s; we run them in parallel so
// total wall time is the longest of the two + scheduling overhead.
// 60s is the Vercel Hobby ceiling; Pro allows up to 300s. Keep
// maxDuration safely above expected max-of-two-parallel.
export const maxDuration = 60;

const PER_CLINIC_TIMEOUT_MS = 55_000;   // safety cap below maxDuration

interface IncomingBody {
  query_text?: unknown;
  patient_first_name?: unknown;
}

type ClinicKey = "sa" | "demo";

interface ClinicDraft {
  clinic_label: string;
  classification: unknown;
  draft: unknown;
  retrieval_chunks: unknown[];
  error?: string | null;
}

interface SingleResponse {
  clinic: ClinicDraft;
  elapsed_ms: number;
}

interface ProxyError {
  error: string;
  detail: string;
  status: number;
}

async function fetchOne(
  apiBase: string,
  secret: string,
  clinic: ClinicKey,
  queryText: string,
  patientFirstName: string | undefined,
): Promise<ClinicDraft | ProxyError> {
  const upstreamUrl = `${apiBase.replace(/\/$/, "")}/api/v1/test/draft-single`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PER_CLINIC_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query_text: queryText,
        patient_first_name: patientFirstName,
        clinic,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!upstream.ok) {
      const status = upstream.status;
      let detail: string | null = null;
      try {
        const upstreamBody = await upstream.json();
        detail = upstreamBody?.detail || upstreamBody?.error || null;
      } catch {
        // not JSON
      }
      return {
        error: `upstream_${status}`,
        status,
        detail:
          (typeof detail === "string" && detail) ||
          (status === 401
            ? "Configuration issue — please contact your admin"
            : status === 429
              ? "Too many tests in a row — give it 60 seconds and try again"
              : status === 503
                ? "The drafts service isn't ready yet — please try again in a few minutes"
                : "Server error — please try again in a moment"),
      };
    }

    const data = (await upstream.json()) as SingleResponse;
    return data.clinic;
  } catch (err: unknown) {
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || err.name === "TimeoutError");
    return {
      error: isAbort ? "upstream_timeout" : "upstream_unreachable",
      status: isAbort ? 504 : 503,
      detail: isAbort
        ? "The AI took too long this time. Please try again — sometimes Bedrock is slow."
        : "Can't reach the drafts service right now. Please try again in a few minutes.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function isProxyError(v: ClinicDraft | ProxyError): v is ProxyError {
  return (v as ProxyError).status !== undefined;
}

function clinicDraftFromError(
  label: "Secret Aesthetics" | "A brand-new clinic",
  err: ProxyError,
): ClinicDraft {
  return {
    clinic_label: label,
    classification: null,
    draft: null,
    retrieval_chunks: [],
    error: err.detail,
  };
}

export async function POST(request: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.DEMO_DRAFT_PAIR_SECRET;
  if (!apiBase) {
    return NextResponse.json(
      {
        error: "config_missing",
        detail:
          "Server isn't configured to reach the drafts service. Please contact your admin.",
      },
      { status: 503 },
    );
  }
  if (!secret) {
    return NextResponse.json(
      {
        error: "config_missing",
        detail:
          "Server isn't configured for authentication. Please contact your admin.",
      },
      { status: 503 },
    );
  }

  let body: IncomingBody;
  try {
    body = (await request.json()) as IncomingBody;
  } catch {
    return NextResponse.json(
      { error: "bad_request", detail: "Invalid request body." },
      { status: 400 },
    );
  }
  if (typeof body.query_text !== "string" || body.query_text.trim() === "") {
    return NextResponse.json(
      { error: "bad_request", detail: "Please enter a patient question." },
      { status: 400 },
    );
  }
  const queryText = body.query_text.trim().slice(0, 4000);
  const patientFirstName =
    typeof body.patient_first_name === "string"
      ? body.patient_first_name.trim().slice(0, 80) || undefined
      : undefined;

  // Fire both clinics in parallel. If one fails, the other still
  // renders — we surface per-panel error messages via ClinicDraft.error
  // (matches the existing UI contract).
  const started = Date.now();
  const [saResult, demoResult] = await Promise.all([
    fetchOne(apiBase, secret, "sa", queryText, patientFirstName),
    fetchOne(apiBase, secret, "demo", queryText, patientFirstName),
  ]);
  const elapsed_ms = Date.now() - started;

  // If BOTH calls hit the same hard auth/config failure, surface as a
  // top-level error so the page renders the global error banner
  // instead of two identical per-panel error cards.
  if (
    isProxyError(saResult) &&
    isProxyError(demoResult) &&
    saResult.status === demoResult.status &&
    (saResult.status === 401 || saResult.status === 503)
  ) {
    return NextResponse.json(
      { error: saResult.error, detail: saResult.detail },
      { status: saResult.status },
    );
  }

  const clinic_a = isProxyError(saResult)
    ? clinicDraftFromError("Secret Aesthetics", saResult)
    : saResult;
  const clinic_b = isProxyError(demoResult)
    ? clinicDraftFromError("A brand-new clinic", demoResult)
    : demoResult;

  return NextResponse.json({ clinic_a, clinic_b, elapsed_ms });
}

// GET serves a health/config probe so you can confirm env vars are
// wired without making a full Bedrock call.
export async function GET() {
  const configured =
    !!process.env.NEXT_PUBLIC_API_URL && !!process.env.DEMO_DRAFT_PAIR_SECRET;
  return NextResponse.json({
    ok: true,
    configured,
    upstream: process.env.NEXT_PUBLIC_API_URL || null,
    proxy_strategy: "parallel-per-clinic via /api/v1/test/draft-single",
  });
}
